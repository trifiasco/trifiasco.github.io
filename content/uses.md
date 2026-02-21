---
title: "What I Use"
description: "Tools, software, and hardware I use for software development"
date: 2026-01-01
draft: false
---

<!-- # What I Use -->

*Last updated: February 2026*

This page lists the tools and software I use for development and productivity. 
<!-- For deep dives into specific tools and workflows, check out my [blog posts](/posts/). -->

---

<!-- ## Hardware -->

<!-- - **Computer:** MacBook Pro 14" M4 Pro(12-core CPU, 16-core GPU, 48GB RAM, 512GB SSD) -->
<!-- - **Keyboard:** [TODO: e.g., Kinesis Advantage360 Pro with custom ZMK layout] -->
<!-- - **Monitor:** [TODO: Add monitor details if applicable] -->
<!-- - **Other:** [TODO: Mouse, trackpad, desk setup, etc.] -->

## Terminal & Shell

- **Terminal Emulator:** [Alacritty](https://alacritty.org/)
- **Shell:** Zsh + [Sheldon](https://github.com/rossmacarthur/sheldon) + [zsh-defer](https://github.com/romkatv/zsh-defer)
- **Prompt:** [Starship](https://starship.rs/)
- **Multiplexer:** [Tmux](https://github.com/tmux/tmux) + [tmuxinator](https://github.com/tmuxinator/tmuxinator)

## Editor

- **Editor:** [Neovim](https://neovim.io/)
- **Plugin Manager:** [lazy.nvim](https://github.com/folke/lazy.nvim)
- **Core Plugins:**
  - Fuzzy finder/picker/explorer - ***snacks.nvim***
  - Completion - ***blink.cmp***
  - Syntax highlighting and text objects - ***nvim-treesitter*** + ***nvim-treesitter-textobjects***
  - LSP - ***nvim-lspconfig*** + ***mason.nvim*** + ***mason-lspconfig.nvim***
  - Color scheme - ***gruvbox***
  - Note taking - ***obsidian.nvim***
- **Config:** [See dotfiles repo for full list](https://github.com/trifiasco/dotfiles/tree/main/dotfiles/nvim/lua/trifiasco/plugins)

## CLI Utilities

- **Fuzzy Finder:** fzf
- **Search:** ripgrep (rg)
- **File Navigation:** fd (find replacement)
- **File Viewing:** bat (cat replacement)
- **Version Control:** git

## Package & Toolchain Management

- **macOS:** [Homebrew](https://brew.sh/)
- **Runtime Versions:** [mise](https://mise.jdx.dev/) (replaces nvm, pyenv, conda)
- **Python:** [uv](https://github.com/astral-sh/uv)
- **Rust:** [rustup](https://rustup.rs/) + Cargo

## Productivity

- **Tiling Window Management:** [Aerospace](https://github.com/nikitabobko/AeroSpace)
- **App Launcher:** [Raycast](https://www.raycast.com/)
- **Task Management:** [TickTick](https://ticktick.com/)

## AI Assistance
- *[Claude Code](https://code.claude.com/docs/en/overview)*
- *[Github Copilot](https://docs.github.com/en/copilot)*

## Dotfiles & Configuration

- **Dotfiles Repository:** [dotfiles](https://github.com/trifiasco/dotfiles)
- **Dotfiles Management:** [dotbot](https://github.com/anishathalye/dotbot)

---

*This page is a living document and gets updated as my setup evolves.*
<!-- For detailed writeups about specific tools and workflows, check out my [blog posts](/posts/).* -->
