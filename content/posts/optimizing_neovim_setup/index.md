---
title: "Optimizing Development Setup"
date: 2026-02-16T17:41:30+01:00
draft: false
slug: "optimizing-dev-setup"
tags: ["neovim", "performance", "benchmarking", "hyperfine", "zsh"]
categories: ["neovim", "tooling"]
description: "From 275ms Neovim and 2.2s zsh startup to 41ms and 64ms — a methodical optimization journey through profiling, lazy loading, and tool replacement."
toc: true
---

I have been meaning to clean up my dotfiles for a while. Lately I have noticed that Neovim felt sluggish on first open and it was really annoying me. Then one weekend I actually measured it: **275ms** to start Neovim. For reference, a clean Neovim starts in about **~32ms**. That is an ~8.5x overhead, and it's entirely self-inflicted. I have been adding stuff left and right without thinking about performance.

While I was profiling Neovim, I also measured my shell startup. **2.2 seconds.** I had not noticed because Powerlevel10k's instant prompt hides the latency (it paints the shell as ready immediately and loads everything else in the background. Smart trick, but it was masking the real problem, not solving it).

This post is about what I found, what I changed, and what actually mattered.


## Measuring the Problem

Before fixing anything, I needed repeatable measurements. There are native profiling tools for both Neovim and zsh, but I found [hyperfine](https://github.com/sharkdp/hyperfine) to be the best single tool for this job. It runs multiple iterations, handles warmup, and gives you mean, standard deviation, and range.

### Native Neovim Profiling

```bash
# Quick startup time measurement (last line shows total)
nvim --headless --startuptime /tmp/startup.log -c 'qall' && tail -1 /tmp/startup.log

# Full breakdown — read the log to see per-module times
nvim --headless --startuptime /tmp/startup.log -c 'qall' && cat /tmp/startup.log

# Inside neovim: per-plugin timing via lazy.nvim
:Lazy profile
```

> The `--startuptime` log has three columns: elapsed, self+sourced, and self. **self** is what matters, it tells you how long that specific module took, excluding its children. Sort by that column when hunting for bottlenecks.

### Native Zsh Profiling

```bash
# Quick measurement without external tools
for i in 1 2 3 4 5; do /usr/bin/time zsh -i -c exit 2>&1 | tail -1; done

# Detailed profiling — add to the top of .zshrc temporarily:
zmodload zsh/zprof
# ... rest of .zshrc ...
zprof   # add to the bottom of .zshrc
```

### Profiling with Hyperfine

[Hyperfine](https://github.com/sharkdp/hyperfine)  provides a convenient way to make repeatable benchmarks with statistical analysis:

For Neovim:
```bash
hyperfine "nvim --headless +qa" --warmup 5
```
For Zsh:
```bash
hyperfine --warmup 5 'zsh -i -c exit'
```
> There will be some difference between measurement of native profiling vs hyperfine profiling. Mostly because hyperfine provides end-to-end measurements. But it's actually a good thing because it reflects real usage experience.

## The Starting Point

### Neovim: 275ms

```bash
hyperfine "nvim --headless +qa" --warmup 5
Benchmark 1: nvim --headless +qa
  Time (mean ± σ):     275.1 ms ±  21.3 ms    [User: 60.1 ms, System: 37.0 ms]
  Range (min … max):   238.8 ms … 308.4 ms    10 runs
```

For comparison, a clean Neovim with no config:

```bash
hyperfine "nvim --clean +qa" --warmup 5
Benchmark 1: nvim --clean +qa
  Time (mean ± σ):      32.8 ms ±   2.5 ms    [User: 8.2 ms, System: 5.7 ms]
  Range (min … max):    29.1 ms …  40.7 ms    62 runs
```

**275ms vs 32ms**. The difference is entirely plugins and configuration.

### Zsh: 2.2 Seconds

(I forgot to save the hyperfine measurement for zsh before optimization :( )

After running `zprof` and timing individual sections, I traced the startup cost to six culprits:

- **nvm sourcing (~500-1500ms)**: nvm is a shell function, not a binary. It sources its entire initialization script on every shell start, does filesystem operations to find and activate the right Node version. The variance alone (500-1500ms) makes the shell feel inconsistent.
- **pyenv init + virtualenv-init (~150-200ms)**: two separate `eval "$(pyenv init -)"` calls, each forking a new process to generate shell code. The process fork overhead alone accounts for most of this.
- **conda init (~100-200ms)**: conda's init block modifies `PATH` and sets up activate/deactivate functions. Even when unused, it runs every startup.
- **Antigen + oh-my-zsh (~100-200ms)**: Antigen is a zsh plugin manager and has seen minimal maintenance in recent years. It was loading the full oh-my-zsh framework to use two plugins, the `git` plugin (aliases I already had in `.zsh_aliases`) and the `macos` plugin (rarely used).
- **`eval "$(uv ...)"` x2 (~60-120ms)**: each `eval` forks a subprocess to generate completion definitions. These are static, they never change unless uv is updated.
- **Powerlevel10k**: not a direct time cost (its instant prompt hides it), but the project is on life support (the developer announced minimal future maintenance) and it was masking the real picture.


## Optimizing Neovim

### Phase 1: Cleaning Up the Obvious

The plugin count was north of 30 with zero lazy loading directives. Every plugin loaded synchronously at startup regardless of whether it would ever be used in that session.

I also had a top level module named `keymaps.lua` containing keybindings. This top-level module used to load on every startup. It was doing eager `require()` calls for plugins, bypassing lazy.nvim's deferred loading before it even got a chance to work.

The root causes:

- **Dead code**: `null-ls.nvim` was included but the plugin is archived and was unused. `FTerm.nvim` was still there even though I use tmux panes for terminals. `vim-repeat` only existed to support `vim-surround`.
- **Eager requires in keymaps.lua**: Top-level `require('telescope.builtin')` and `require('FTerm')` forced those plugins to initialize at module load time. This is one of the major culprits, lazy.nvim thinks it is deferring the plugin, but keymaps.lua has already triggered the load.
- **No lazy directives**: 30+ plugins with no `event`, `cmd`, `keys`, or `ft`. Plugin manager (lazy.nvim) loads them all at startup by default.

The fix for the eager requires:

```lua
-- Before: keymaps.lua (top-level requires force plugin loading)
local builtin = require('telescope.builtin')
local fterm = require('FTerm')

vim.keymap.set('n', '<leader>ff', builtin.find_files)
vim.keymap.set('n', '<A-i>', fterm.toggle)

-- After: keymaps.lua (clean — no plugin requires at top level)
-- Plugin keymaps are defined in their respective plugin specs,
-- not here. This file only contains editor-level keymaps.
```

For the remaining plugins, I added lazy loading directives based on how each plugin is actually used:

| Plugin | Lazy directive | Why |
|--------|---------------|-----|
| gitsigns.nvim | `event = { "BufReadPost", "BufNewFile" }` | Only needed when viewing a file |
| vim-fugitive | `cmd = { "Git", "Gvdiffsplit" }` | Only when running git commands |
| diffview.nvim | `cmd = { "DiffviewOpen" }` | Only when explicitly opening diff |
| rustaceanvim | `ft = "rust"` | Only for Rust files |
| nvim-dap-python | `ft = "python"` | Only for Python files |
| treesitter | `event = { "BufReadPre", "BufNewFile" }` | Only when viewing a file |

**Result: 275ms → ~150ms.** Half the overhead gone, no new plugins added.


### Phase 2: Replacing the Old Guard

Some plugins had simply aged out. The next round was about replacing Vimscript-era plugins and slow plugin combos with modern Lua alternatives.

- **telescope.nvim + neo-tree → snacks.nvim**: Two separate plugins replaced with one. [snacks.nvim](https://github.com/folke/snacks.nvim) bundles a picker (telescope-equivalent) and a file explorer (neo-tree-equivalent) with a notably lower startup cost.
- **nvim-cmp → blink.cmp**: The completion plugin rewrite. [blink.cmp](https://github.com/saghen/blink.cmp) is written in Rust for the hot paths, with a much smaller Lua footprint. The configuration shape is different but the migration was straightforward.
- **vim-surround → mini.surround**: Replace the Vimscript plugin with a Lua one from the [mini.nvim](https://github.com/echasnovski/mini.nvim) collection. Same functionality, native dot-repeat support, smaller surface area. This also let me drop `vim-repeat`.


**Result: ~150ms → ~65-100ms.**


### Phase 3: LSP 2.x Migration

Neovim 0.11 introduced `vim.lsp.config` and `vim.lsp.enable` as the native LSP API, deprecating the lspconfig 1.x pattern. This was not a performance change, rather a maintenance change that I have been deferring for a while.

The API change is clean:

```lua
-- Before: lspconfig 1.x pattern
local lspconfig = require("lspconfig")
lspconfig.pyright.setup({
    on_attach = on_attach,
    capabilities = capabilities,
    settings = { ... }
})

-- After: Neovim 0.11+ native API
vim.lsp.config("pyright", {
    settings = { ... },
    on_init = function(client)
        client.config.settings.python.pythonPath = get_python_path(client.config.root_dir)
    end,
})
vim.lsp.enable({ "pyright", "ruff", "lua_ls" })
```

The shared `on_attach` function is replaced by a global `LspAttach` autocmd, which is more composable because you can add buffer-local keymaps from multiple places without them interfering:

```lua
vim.api.nvim_create_autocmd("LspAttach", {
    group = vim.api.nvim_create_augroup("lsp-attach-keymaps", { clear = true }),
    callback = function(event)
        local bufnr = event.buf
        local map = function(keys, func, desc)
            vim.keymap.set("n", keys, func, { buffer = bufnr, desc = "LSP: " .. desc })
        end

        map("<leader>rn", vim.lsp.buf.rename, "Rename")
        map("<leader>ca", vim.lsp.buf.code_action, "Code Action")
        map("<leader>ld", vim.diagnostic.open_float, "Line Diagnostic")
        map("K", vim.lsp.buf.hover, "Hover Documentation")

        vim.api.nvim_buf_create_user_command(bufnr, "Format", function(_)
            vim.lsp.buf.format()
        end, { desc = "Format current buffer with LSP" })
    end,
})
```

> If you have written your own LSP config from scratch, I wrote a [deep dive on how LSP works](/posts/lsp-deep-dive/) including building a toy language server in Rust. Understanding the protocol makes debugging LSP issues much less mysterious.

**Result: No startup change from Phase 3 alone.**


### Phase 4: A Few Micro Optimizations

After phases 1-3, startup was around 65-100ms. I was happy with that. But I wanted to see if I could push for more.

**1. Enable the bytecode cache**

```lua
-- Near the top of init.lua, after leader keys
vim.loader.enable()
```

Neovim has a built-in Lua bytecode cache since 0.9. Every `require()` call is a filesystem lookup by default. `vim.loader.enable()` converts `.lua` files to bytecode on first load and caches them. No configuration needed, one line.

**2. Disable builtins the right way**

Instead of setting `vim.g.loaded_*` variables for each builtin plugin (the old pattern), move the list into lazy.nvim's `performance.rtp.disabled_plugins`:

```lua
require("lazy").setup({ import = "trifiasco.plugins" }, {
  change_detection = {
    notify = false,
  },
  performance = {
    rtp = {
      disabled_plugins = {
        "gzip",
        "matchit",
        "matchparen",
        "netrwPlugin",
        "tarPlugin",
        "tohtml",
        "tutor",
        "zipPlugin",
      },
    },
  },
})
```

> `disabled_plugins` strips these from the runtimepath before Neovim tries to source them, more thorough than the `vim.g.loaded_*` variable approach. Note that `matchparen` and `matchit` are included, two plugins that silently add cost to every buffer open. This approach is lazy.nvim-specific; the old variable method still works, just less reliably.


**Result: ~65ms → 41.4ms.**

```bash
hyperfine "nvim --headless +qa" --warmup 5
Benchmark 1: nvim --headless +qa
  Time (mean ± σ):      41.4 ms ±   0.8 ms    [User: 35.0 ms, System: 18.5 ms]
  Range (min … max):    38.8 ms …  42.8 ms    68 runs
```


## Optimizing Zsh

The zsh optimization was a different kind of project. Where Neovim was about tweaking load order and adding directives, zsh required wholesale tool replacement. The old tools were fundamentally expensive to initialize.

### The Replacements

#### nvm, pyenv, conda → mise (~5ms)

[mise](https://mise.jdx.dev/) is a single Rust binary that manages Node, Python, Ruby, Go, and more. One `eval` replaces three separate tool initializations:

```bash
# Before: three separate version manager initializations
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"     # ~1000ms

eval "$(pyenv init -)"                                 # ~100ms
eval "$(pyenv virtualenv-init -)"                     # ~100ms

# >>> conda initialize >>>                             # ~150ms
# [14 lines of conda init block]
# <<< conda initialize <<<

# After: one tool, one eval
eval "$(mise activate zsh)"                            # ~5ms
```

mise does not source a shell function, it is a compiled binary that outputs the necessary `PATH` modifications and hook functions. The difference is process startup time: forking a Rust binary is fast, sourcing a shell script that does filesystem I/O is not.

#### Antigen + oh-my-zsh → sheldon + zsh-defer (~10ms)

[sheldon](https://github.com/rossmacarthur/sheldon) is a Rust-based plugin manager that generates shell code from a TOML config. The key insight is pairing it with [zsh-defer](https://github.com/romkatv/zsh-defer). Plugins load *after* the prompt renders, so the user sees the prompt immediately while autosuggestions and syntax highlighting attach in the next event loop tick.

{{< code lang="toml" filename="~/.config/sheldon/plugins.toml" >}}
shell = "zsh"

[templates]
defer = "{% for file in files %}zsh-defer source \"{{ file }}\"\n{% endfor %}"

[plugins.zsh-defer]
github = "romkatv/zsh-defer"

[plugins.zsh-autosuggestions]
github = "zsh-users/zsh-autosuggestions"
apply = ["defer"]

[plugins.zsh-completions]
github = "zsh-users/zsh-completions"
dir = "src"
apply = ["fpath"]

[plugins.fast-syntax-highlighting]
github = "zdharma-continuum/fast-syntax-highlighting"
apply = ["defer"]
{{< /code >}}

Key things to notice:
- **`zsh-defer`** is loaded first as a regular plugin, then used as a template for subsequent plugins
- **`zsh-autosuggestions`** and **`fast-syntax-highlighting`** use `apply = ["defer"]`, they are sourced asynchronously after the prompt appears
- **`zsh-completions`** uses `apply = ["fpath"]`: it just adds to the function path, no sourcing needed
- **`fast-syntax-highlighting`** replaces `zsh-syntax-highlighting`: it is an alternative with better performance
- **`zsh-vi-mode`** is dropped entirely: `bindkey -v` in `.zshrc` covers the core need

#### Powerlevel10k → starship (~20ms)

[starship](https://starship.rs/) is a cross-shell prompt written in Rust. p10k's instant prompt is clever engineering, but the project has been effectively on life support since mid 2024. Starship is actively maintained and the configuration is minimal:

{{< code lang="toml" filename="~/.config/starship.toml" >}}
format = """$directory$git_branch$git_status$python$nodejs$rust$character"""

[directory]
truncation_length = 3

[git_branch]
format = "[$branch]($style) "

[git_status]
format = '([$all_status$ahead_behind]($style) )'

[python]
format = '[py $version]($style) '

[nodejs]
format = '[node $version]($style) '

[character]
success_symbol = "[>](bold green)"
error_symbol = "[>](bold red)"
{{< /code >}}

The `format` string controls which modules appear. Everything not listed is suppressed. The result is clean: directory, git info, active language version, and a `>` prompt character.

#### eval uv → cached fpath completions (0ms)

`eval "$(uv generate-shell-completion zsh)"` generates the same output every time and it only changes when uv is updated. Run it once, write to a file, load it via `fpath`:

```bash
# Run once (not in .zshrc) — re-run after uv updates
mkdir -p ~/.local/share/zsh/completions
uv generate-shell-completion zsh > ~/.local/share/zsh/completions/_uv
uvx --generate-shell-completion zsh > ~/.local/share/zsh/completions/_uvx
```

```bash
# In .zshrc — load from cache, no subprocess fork
fpath=(~/.local/share/zsh/completions $fpath)
```

Two `eval` calls that forked subprocesses on every startup are now a directory addition to `fpath`. Cost: zero.

## Results

### Neovim

**6.6x faster than the 275ms starting point, and within ~10ms of a clean `nvim --clean` launch.**

```bash
hyperfine "nvim --headless +qa" --warmup 5
Benchmark 1: nvim --headless +qa
  Time (mean ± σ):      41.4 ms ±   0.8 ms    [User: 35.0 ms, System: 18.5 ms]
  Range (min … max):    38.8 ms …  42.8 ms    68 runs
```

### Zsh
**From 2.2 seconds to 64ms.**

```bash
hyperfine --warmup 5 'zsh -i -c exit'

Benchmark 1: zsh -i -c exit
  Time (mean ± σ):      64.2 ms ±   1.3 ms    [User: 31.1 ms, System: 29.6 ms]
  Range (min … max):    62.3 ms …  70.9 ms    45 runs
```

### Summary

| Tool | Before | After | Improvement |
|------|--------|-------|-------------|
| Neovim | 275ms | 41.4ms | 6.6x |
| Zsh | ~2,200ms | 64.2ms | ~34x |


## Personal Notes

1. **sheldon requires an initial `sheldon lock`.** On a fresh machine, you need to run `sheldon lock` before the shell config works. It downloads the plugins listed in `plugins.toml` and generates a lock file. After that, `eval "$(sheldon source)"` is fast because it reads from the lock file.

2. **Hyperfine warmup matters.** All benchmarks in this post use `--warmup 5`, which means the first 5 runs are discarded. Cold cache performance is different. The first launch after a reboot will be slower due to filesystem caching. The warmup numbers represent steady-state development, which is what actually matters for daily use.

3. **Treesitter plugin has a major breaking change.** For now I have pinned to the `master` branch because I was feeling lazy and didn't want to migrate. I don't see any performance gain from this migration. But I probably should migrate soon.

4. **Mise is really cool.** It replaces `nvm`, `pyenv`, and a few more things. It also plays well with `uv` which is what I currently use for python environment and deps.

5. I had been living with 2.2 second shell startup for at least a year. Powerlevel10k's instant prompt made it invisible. I only measured it because I happened to be profiling Neovim already. Sometimes the thing you are not measuring is the worst one.

6. I kept the `zsh-vi-mode` plugin for years because I wanted the `kj` escape binding in the shell. Turns out `bindkey -M viins 'kj' vi-cmd-mode` is one line in `.zshrc`. Years of loading a plugin for one line.

7. I also tried adding lazy loading for LSP and treesitter, but I faced some issues with it. So I removed it. Need to take a deeper look at that.
