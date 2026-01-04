---
title: "How LSP works: Building an LSP Server from Scratch with Rust"
date: 2026-01-02T14:14:56+01:00
draft: false
slug: "lsp-deep-dive"
tags: ["lsp", "rust", "neovim", "developer-tools"]
categories: ["programming", "tooling"]
description: "Understanding Language Server Protocol from architecture to implementation - building a grammar checker LSP from scratch with Rust"
toc: true
---

## What is LSP?

Language Server Protocol (LSP) is what powers code intelligence in modern editors/IDEs. So things like auto completion, go to definition/references, or showing diagnostics and lint errors are all delivered within your favourite editor through LSP.

But let's start with the problem first, so that you can understand the painpoints before LSP and how it solves that problem in an elegant way.

### The Problem

Imagine you are building a new editor and you want to support the go to definition/references feature. Meaning when the user clicks on a function/method name, you want to navigate to the place where that function/method is defined in the codebase.

Now roughly this is what you would need to do to support this feature:
- **Syntactic Analysis**: Parse the code and extract tokens/symbols (ex - function name, variable names etc.). 
    - *AST*: Build a hierarchical representation of the code AST (Abstract Syntax Tree)
    - *Symbol Table*: During AST traversal, also build an index of all declared methods, variables etc. Each entry in the table maps a token/symbol to it's specific location.
- **Semantic Analysis**: Contextualize the tokens/symbols and assign meaning to the tokens/symbols.
    - *Scope analysis*: Identify the context of the variable.(ex - local vs global one), where it's declared vs where it's being used etc.
    - *Type resolution*: Resolve the type of an expression to determine things like which class's method is being called.

Take the following code example, we have two classes and both have a method with the same name (`area`). So you need to differentiate between two methods by resolving the scope and type to determine the context/meaning of each one.

``` Python
class Rectangle:
    ...
    def area(self):
        return self.height * self.width
    ...

class Square:
    ...
    def area(self):
        return self.side * self.side
    ...
obj = Rectangle(3, 4)
# --> Type resolution will have to figure out
# --> this obj is actually a Rectangle object
# --> And area method belongs to the Rectangle class and not the Square one
res = obj.area() 
```

This is a substantial task - and we have only covered one feature for one language! But let's say you have pushed through and built the feature for Python because that's the language you use. Then you shared the editor to some of your friends. They started using it. But one of them exclusively works with Javascript. So he asks you to implement the feature for Javascript!!

You implement all the syntactic and semantic analysis for Javascript. Your friend is happy. 

Then someone else reaches out and they want you to support the feature for Rust. 

**Do you see the problem..?? And all this for just one feature!!**


**In a world, if you have N number of editors and M number of programming languages, The above mentioned way would require NxM implementations for any one of the intelligence features.**

{{< figure src="./no_lsp.png" alt="No LSP Architecture" caption="Figure 1: Architecture without LSP" >}}

### The Solution

This is where LSP comes in. The idea is to standardize the protocol for how such language feature implementations and development tool(editor) communicate. So a single implementation of a language specific implementation can be re-used in multiple development tools.

This is a win for both development tool developers and language providers. Both can focus on their specific tooling. 

**With N number of editors and M number of programming languages, LSP reduces the required implementations to be `N+M`**

{{< figure src="./with_lsp.png" alt="LSP Architecture" caption="Figure 2: Architecture with LSP" >}}

**Bottom Line: LSP reduces the complexity from polynomial (`O(N*M)`) to linear (`O(N+M)`)**

## Technical Terms

Before we dive deep into technical specifics, let's define the terms that I will use throughout the article - 

- **LSP Client:** The developer tools(i.e., editors, IDEs) are referred as the `LSP clients`. Or just `clients` for simplicity.
- **Language Servers:** The implementation of language specific features are referred as `language servers`. Or just `servers` for simplicity.
- **LSP:** The standardized communication protocol through which `LSP client` and `servers` communicates.
- **JSON-RPC:** The communication protocol for LSP. It's a simple and lightweight protocol. Both client and server uses structured JSON object for RPC requests and responses. The data types are language-agnostic, making the protocol simple and universally compatible.
- **Buffer:** A document/file loaded into memory is referred as buffer.
- **capabilities:** Things a server is capable of doing for a specific language. For example, the `go to definition` feature we talked above is a capability. Depending on language and server implementation, the capabilities might vary.
- **Request vs Notification:** In LSP term, notification means a one way message that doesn't send any response back. Requests on the other hand means that the method should return a response. For example `textDocument/definition` is a request method as it returns a location. Conversely, `textDocument/didChange` just informs the server, hence it's a notification method.


## How it works

The architecture is similar to client-server systems that might be already familiar with. A typical flow roughly looks like this - 

1. Document Lifecycle: You open a python file in your editor(the `Client`). This does a few things:
    - start the python specific language server(the `Server`) and attach it to the buffer.
    - `Client` sends an `initialize` request to the `Server` asking it to initialize. 
    - `Server` acknowledges the request and sends back list of things the `Server` is capable of doing for this type of document.
    - Followed by a successful initialization, a notification is sent from the `Client` to the `Server` with document URI, full text content, language identifier. From now on, the source of truth about the document content is maintained by the `Server` in memory. Any changes to the document must be synchronized between `Client` and `Server`.

{{< figure src="./didOpen_flow.png" alt="LSP didOpen Flow" caption="Figure 3: LSP flow for document open" >}}


2. Feature Requests: You execute a "go to definition" request for a symbol:
    - `Client` sends a notification/request to the `Server` asking where is the definition of this particular symbol?
    - `Server` looks up the symbol table and returns the line number where the definition of that particular symbol is located.
    - `Client` parses the response and navigates to that line number.


{{< figure src="./definition_flow.png" alt="LSP Go to Definition Flow" caption="Figure 4: LSP flow for Go to definition" >}}

### Key LSP methods
- **Document Synchronization**: The server must maintain the state of a document to provide features like go to definition. So every time a document is opened or changed, the Client sends the edits and server internally updates the state of the document, symbol tables.
    - `textDocument/didOpen`
    - `textDocument/didChange`
    - `textDocument/didClose`
    - `textDocument/didSave`
- **Language features**: Code comprehension features like Hover or Go to definition, diagnostics, code completions/actions.
    - `textDocument/definition`
    - `textDocument/declaration`
    - `textDocument/hover`
    - `textDocument/publishDiagnostics`
    
See the [official doc](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.17/specification/) for full reference


### JSON-RPC Communication Mechanism
LSP uses stdin/stdout for JSON-RPC communication between Client and Server and stderr is used for debugging and logging.

The communication flow:
  1. Editor to LSP Server (stdin): Editor sends JSON-RPC requests like `textDocument/didSave` through stdin.
  2. LSP Server to Editor (stdout): Server sends JSON-RPC responses and notifications like `textDocument/publishDiagnostics` through stdout.
  3. LSP Server to Log file (stderr): Debug and server log statements go to stderr, which is redirected typically to a log file like `lsp.log`.


#### Example Request-Response object
Here's what an actual request-response looks like for `Go to definition`:

Request:
```python
{
    "jsonrpc": "2.0",
    "id" : 1,
    "method": "textDocument/definition", # what's the type of request?
    "params": {
        "textDocument": {
            "uri": "file:///path/filename.py" # which file?
        },
        "position": { # what's the position of the symbol inside the file?
            "line": 3,
            "character": 12
        }
    }
}
```
Response:
```python
{
    "jsonrpc": "2.0",
    "id": 1,
    "result": {
        "uri": "file:///path/filename.py", # The file path where the definition can be found

        # The position(line/column number) in the file where the definition can be found
        "range": { 
            "start": {
                "line": 0,
                "character": 4
            },
            "end": {
                "line": 0,
                "character": 11
            }
        }
    }
}
```

## Extending LSP: beyond programming language features
What makes the LSP specially interesting is it's extensibility. While it started out for providing language specific features, it can provide all kinds of capabilities.

One of the most interesting non-language specific capability is AI code suggestions/assistance.

Take github copilot for example. What it does essentially is - based on your recent change, it uses an LLM to provide suggestions/completions. The LLM inference mechanism isn't tied to any specific language. The core flow is same for all language.

The `textDocument/inlineCompletion` request is used to provide inline("ghost text") completion. This is added in the [3.18 version](https://microsoft.github.io/language-server-protocol/specifications/lsp/3.18/specification/#textDocument_inlineCompletion) of the LSP spec. Similarly a custom method (not part of the spec yet) `textDocument/copilotInlineEdit` is used to provide "next edit" suggestions.

And the idea is your editor/IDE doesn't have to handle LLM inference, request/response parsing etc. It can just use/call the `inlineCompletion` and `copilotInlineEdit` capabilities to get the suggestions. And you can use [copilot's lsp server](https://github.com/github/copilot-language-server-release) to get completion from github models or you can build your custom language server that uses whichever model you prefer. For example, hugging face has a version of this called [llm-ls](https://github.com/huggingface/llm-ls).

One more cool thing, the LSP client doesn't have to be an editor/IDE. It can be any other development tool. For example, Claude Code now supports native [LSP](https://code.claude.com/docs/en/plugins-reference#lsp-servers) and you can setup LSP tools that provides code semantics directly to the LLM. This means Claude Code can access your codebase's type information and symbol tables directly to get the "correct" scope and signatures, reducing scope for hallucination.


## Let's build one
At this point, you should have a good understanding the concepts of LSP. So let's build a language server to see how different methods work in practice.

### Scope & Goals
We will build a language server that:
- Attaches to markdown files when opened.
- Tracks document changes as you type.
- Triggers grammar/spelling checks when you save.
- Displays errors as diagnostics in your editor.

What it would look like in action:

{{< figure src="./grammar_lsp.png" alt="Grammar LSP Demo" caption="Figure 5: Grammar LSP Demo" >}}

The goal is to:
- Demonstrate the full LSP lifecycle.
- Show non programming language capability.
- Illustrate flows like document synchronization and how diagnostics flow from server to client.

Also it's simple and as it doesn't operate on code, so doesn't require semantic analysis.

### Implementation Steps
1. Step 1: Minimal LSP server (`initialize` + `shutdown`)
2. Step 2: Document Synchronization (`didOpen` + `didChange` + `didClose`)
3. Step 3: Publishing diagnostics (`didSave` + `publishDiagnostics`)
4. Step 4: Grammar checking (LLM integration)

**See the full code in the [github-repo](https://github.com/trifiasco/grammar-lsp)**

### Setup and prerequisite
Before we start, setup the development environment:
1. Download and install [Ollama](https://ollama.com/) and pull one of the smaller models.(I recommend gemma3:4b which I used to test)
    ```bash
    ollama pull gemma3:4b
    ollama serve # keep this running in a terminal
    ```
2. Install [Rust](https://rust-lang.org/tools/install/)
3. Create a project: `cargo new grammar-lsp`
4. Add the following dependencies in the Cargo.toml:
    ```toml
    [dependencies]
    tower-lsp = "0.20" # LSP boilerplate implementation
    tokio = { version = "1", features = ["full"] } # Async runtime
    serde = { version = "1.0", features = ["derive"] } # serialization
    serde_json = "1.0" # json parsing
    dashmap = "6.1" # thread-safe HashMap to store the document content
    reqwest = { version = "0.12", features = ["json"] } # http client
    ```

### Step 1: Minimal LSP Server

Let's start with the absolute minimum - a server that responds to initialize and shutdown requests.
```Rust
// src/main.rs
use tower_lsp::jsonrpc::Result;
use tower_lsp::lsp_types::*;
use tower_lsp::{Client, LanguageServer, LspService, Server};

#[derive(Debug)]
struct Backend {
    client: tower_lsp::Client,
}
impl Backend {
    fn new(client: Client) -> Self {
        Self { client }
    }
}

#[tower_lsp::async_trait]
impl LanguageServer for Backend {
    async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
        Ok(InitializeResult {
            capabilities: ServerCapabilities::default(),
            server_info: Some(ServerInfo {
                name: "grammar-lsp".to_string(),
                version: Some("0.1.0".to_string()),
            }),
        })
    }
    async fn initialized(&self, _: InitializedParams) {
        self.client
            .log_message(MessageType::INFO, "Grammar LSP initialized")
            .await;
    }
    async fn shutdown(&self) -> Result<()> {
        Ok(())
    }

}

#[tokio::main]
async fn main() {
  let stdin = tokio::io::stdin();
  let stdout = tokio::io::stdout();

  let (service, socket) = LspService::new(|client| Backend::new(client));

  Server::new(stdin, stdout, socket).serve(service).await;
}
```

#### Key things to notice:
- Backend struct: Holds the client, which is how we send messages back to the editor
- #[tower_lsp::async_trait]: Macro that makes the trait async-compatible
- initialize: Editor asks "what can you do?" - we respond with empty capabilities (for now)
- initialized: Editor says "I've processed your capabilities" - we log a message
- shutdown: Editor is closing - clean up (nothing to clean up yet)
- main: Connects stdin/stdout to the LSP server and starts serving


### Step 2: Document Synchronization

Next we will track document content and implement the document synchronization.

First add DashMap to store and track documents. As we are using Tokio async runtime, it's possible to receive multiple method request simultaneously. So a regular HashMap would cause data races. DashMap provides thread-safe concurrent access.

```Rust
use dashmap::DashMap;

#[derive(Debug)]
struct Backend {
    client: tower_lsp::Client,
    documents: DashMap<String, String>, // URI -> document content
}
impl Backend {
    fn new(client: Client) -> Self {
        Self {
            client,
            documents: DashMap::new(),
        }
    }
}

```

Next add the document lifecycle LSP methods (add to the LanguageServer impl):

```Rust
async fn did_open(&self, params: DidOpenTextDocumentParams) {
    let uri = params.text_document.uri.to_string();
    self.documents.insert(uri, params.text_document.text);
}

async fn did_change(&self, params: DidChangeTextDocumentParams) {
    if let Some(change) = params.content_changes.first() {
        let uri = params.text_document.uri.to_string();
        self.documents.insert(uri, change.text.clone());
    }
}

async fn did_close(&self, params: DidCloseTextDocumentParams) {
    let uri = params.text_document.uri.to_string();
    self.documents.remove(&uri);
}
```

#### key things to notice:

- `didOpen`: Editor opened a file - store the initial content as value and URI as key
- `didChange`: User typed something - update our stored content.
- `didClose`: File was closed - remove it from memory.

Next advertise these capabilities by updating the initialize method:

```Rust
async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
    Ok(InitializeResult {
        capabilities: ServerCapabilities {
            text_document_sync: Some(TextDocumentSyncCapability::Options(
                TextDocumentSyncOptions {
                    open_close: Some(true), // We handle didOpen/didClose
                    change: Some(TextDocumentSyncKind::FULL), // Send full doc on change
                    ..Default::default()
                },
            )),
            ..Default::default()
        },
        server_info: Some(ServerInfo {
            name: "grammar-lsp".to_string(),
            version: Some("0.1.0".to_string()),
        }),
    })
}
```

> Note on `TextDocumentSyncKind::FULL`: This is very bad, I know. It means everytime any change happens, the client will send the full content, which is not optimal at all. 

> In a production system, the sync would happen incrementally with `TextDocumentSyncKind::INCREMENTAL`, meaning the client will only send the changeset.

> I think for our use case, this is an acceptable corner to cut, given this is to illustrate LSP functionalities and not to build a production system.



### Step 3: Publishing Diagnostics

Now let's add the core functionality: checking grammar on save and publishing errors as diagnostics.

Add the `didSave` method handler (add to LanguageServer impl):

```Rust
async fn did_save(&self, params: DidSaveTextDocumentParams) {
    let uri = params.text_document.uri.to_string();

    if let Some(text) = self.documents.get(&uri) {
         // Check grammar and get diagnostics
        let diagnostics = self.check_grammar(&params.text_document.uri, &text).await;

        // Publish diagnostics back to the client
        self.client
            .publish_diagnostics(params.text_document.uri, diagnostics, None)
            .await;
    }
}
```

Add the save capability in the `initialize` method:
```rust
async fn initialize(&self, _: InitializeParams) -> Result<InitializeResult> {
    Ok(InitializeResult {
        capabilities: ServerCapabilities {
            text_document_sync: Some(TextDocumentSyncCapability::Options(
                TextDocumentSyncOptions {
                    open_close: Some(true),
                    change: Some(TextDocumentSyncKind::FULL),
                    save: Some(TextDocumentSyncSaveOptions::SaveOptions(SaveOptions {
                        include_text: Some(false),
                    })), // Add this
                    ..Default::default()
                },
            )),
            ..Default::default()
        },
        server_info: Some(ServerInfo {
            name: "grammar-lsp".to_string(),
            version: Some("0.1.0".to_string()),
        }),
    })
}
```

Add a stub grammar checker (add to the Backend impl):

```Rust
async fn check_grammar(&self, _uri: &Url, text: &str) -> Vec<Diagnostic> {
      // TODO: Actually check grammar. will update after LLM integration
      // For now, return a fake diagnostic to test the flow
      vec![Diagnostic {
          range: Range {
              start: Position { line: 0, character: 0 },
              end: Position { line: 0, character: 5 },
          },
          severity: Some(DiagnosticSeverity::WARNING),
          source: Some("grammar-checker".to_string()),
          message: "Test diagnostic - grammar checking not implemented yet".to_string(),
          ..Default::default()
      }]
  }
```

### Step 4: LLM integration

Now let's implement the actual grammar checking by calling a local LLM.

We will organize this into separate modules to keep concerns separated. This part is **swappable** - you could replace Ollama with OpenAI or any other service.

1. Create the data types (`src/ollama.rs`):

```Rust
use serde::{Deserialize, Serialize};

/// Ollama API request structure
#[derive(Debug, Serialize)]
pub struct OllamaRequest {
    pub model: String,
    pub prompt: String,
    pub format: String,
    pub stream: bool,
}

/// Ollama API response structure
#[derive(Debug, Deserialize)]
pub struct OllamaApiResponse {
    pub response: String,
}

/// Grammar issue detected by LLM
#[derive(Debug, Deserialize, Serialize)]
pub struct GrammarIssue {
    pub line: u32,
    pub column: u32,
    pub message: String,
}

/// Structured response from Ollama containing grammar issues
#[derive(Debug, Deserialize, Serialize)]
pub struct OllamaResponse {
    pub issues: Vec<GrammarIssue>,
}
```
 These types map to Ollama's HTTP API and our expected response format.

2. Create the grammar check provider (`src/grammar_client.rs`). What it essentially does:
- Build the prompt with system instruction and document content.
- Prepare params and send the request to Ollama.
- Upon receiving a response, parse it into expected diagnostics data format.

```Rust
use crate::ollama::{GrammarIssue, OllamaApiResponse, OllamaRequest, OllamaResponse};

/// Grammar checking provider that interfaces with Ollama HTTP API
#[derive(Debug)]
pub struct GrammarCheckProvider {
    http_client: reqwest::Client,
    model: String,
    api_url: String,
    timeout_secs: u64,
}

impl GrammarCheckProvider {
    /// Create a new grammar check provider with default settings
    pub fn new() -> Self {
        Self {
            http_client: reqwest::Client::new(),
            model: "gemma3:4b".to_string(),
            api_url: "http://localhost:11434/api/generate".to_string(),
            timeout_secs: 60,
        }
    }

    /// Check grammar and spelling in the provided text
    pub async fn check_grammar(&self, text: &str) -> Vec<GrammarIssue> {
        eprintln!("[Grammar Check] Starting check for {} bytes of text", text.len());

        let prompt = self.build_prompt(text);
        let request = self.build_request(prompt);

        match self.send_request(request).await {
            Ok(api_response) => {
                eprintln!("[Grammar Check] Response: {}", api_response.response);
                self.parse_response(&api_response.response)
            }
            Err(e) => {
                eprintln!("[ERROR] Grammar check failed: {}", e);
                vec![]
            }
        }
    }

    /// Build the prompt for the LLM
    fn build_prompt(&self, text: &str) -> String {
        format!(
            r#"You are a grammar and spelling checker. Your task is to find errors in the text below.

  IMPORTANT: You must respond with ONLY valid JSON in this exact format:
  {{
    "issues": [
      {{"line": 1, "column": 5, "message": "Spelling: 'teh' should be 'the'"}},
      {{"line": 2, "column": 10, "message": "Grammar: 'was went' should be 'went'"}}
    ]
  }}

  If there are no errors, return: {{"issues": []}}

  Rules:
  1. line numbers start at 1
  2. column numbers start at 0
  3. message format: "<error type>: '<incorrect>' should be '<correct>'"
  4. error types: "Spelling" or "Grammar"
  5. Do NOT include explanations, only the JSON object

  Text to analyze:
  {}"# ,text)
    }

    /// Build Ollama API request
    fn build_request(&self, prompt: String) -> OllamaRequest {
        OllamaRequest {
            model: self.model.clone(),
            prompt,
            format: "json".to_string(),
            stream: false,
        }
    }

    /// Send request to Ollama API with timeout
    async fn send_request(&self, request: OllamaRequest) -> Result<OllamaApiResponse, String> {
        eprintln!("[Grammar Check] Calling Ollama API...");

        let response = tokio::time::timeout(
            std::time::Duration::from_secs(self.timeout_secs),
            self.http_client
                .post(&self.api_url)
                .json(&request)
                .send(),
        )
        .await
        .map_err(|_| "Ollama timeout".to_string())?
        .map_err(|e| format!("Ollama request failed: {}", e))?;

        eprintln!("[Grammar Check] Ollama responded");

        response
            .json::<OllamaApiResponse>()
            .await
            .map_err(|e| format!("Failed to decode API response: {}", e))
    }

    /// Parse the JSON response from Ollama into grammar issues
    fn parse_response(&self, response_text: &str) -> Vec<GrammarIssue> {
        match serde_json::from_str::<OllamaResponse>(response_text) {
            Ok(grammar_response) => {
                eprintln!("[Grammar Check] Found {} issues", grammar_response.issues.len());
                grammar_response.issues
            }
            Err(e) => {
                eprintln!("[ERROR] Failed to parse JSON: {}", e);
                eprintln!("[ERROR] Raw response: {}", response_text);
                vec![]
            }
        }
    }
}

```

#### Key things to notice:
1. Error handling: If Ollama fails or times out, we return an empty list instead of crashing. This keeps the editor/client functional even when the LLM is unavailable.
2. 60-second timeout: Local LLM requests can be slow. Without a timeout, a hung request would freeze the server. Depending on your machine spec, **you might need to finetune this value**.
3. eprintln! for logging: All debug output goes to stderr, which LSP clients redirect to log files. **This is how you'll debug issues**. Although in production environment you should use `tracing-appender` and `tracing-subscriber` crate for better logging and tracing configuration.

With our LLM call module completed, We can now update `main.rs` to use the new grammar check provider that we just implemented:

``` Rust
// --> import modules
mod grammar_client;
mod ollama;

use grammar_client::GrammarCheckProvider;

#[derive(Debug)]
struct Backend {
    client: Client,
    documents: DashMap<String, String>,
    grammar_provider: GrammarCheckProvider, // --> Add this field
}

impl Backend {
    fn new(client: Client) -> Self {
        Self {
            client,
            documents: DashMap::new(),
            grammar_provider: GrammarCheckProvider::new() // --> Add this field
        }
    }
}
```

And replace the stubbed `check_grammar` to actually call the provider:

```Rust
async fn check_grammar(&self, _uri: &Url, text: &str) -> Vec<Diagnostic> {
    let issues = self.grammar_provider.check_grammar(text).await;

    issues
        .into_iter()
        .map(|issue| {
            // LSP lines are 0-indexed, but LLM returns 1-indexed
            let line = if issue.line > 0 { issue.line - 1 } else { 0 };

            Diagnostic {
                range: Range {
                    start: Position {
                        line,
                        character: issue.column,
                    },
                    end: Position {
                        line,
                        character: issue.column + 1,
                    },
                },
                severity: Some(DiagnosticSeverity::WARNING),
                source: Some("grammar-checker".to_string()),
                message: issue.message,
                ..Default::default()
            }
        })
        .collect()
}
```

Finally, update the `didClose` to clear diagnostics when a file closes:

```Rust
async fn did_close(&self, params: DidCloseTextDocumentParams) {
        let uri = params.text_document.uri.to_string();
        self.documents.remove(&uri);

        // Clear diagnostics
        self.client
            .publish_diagnostics(params.text_document.uri, vec![], None)
            .await;
    }
```

That's it! The language server implementation is done. Let's build and test.

Run: `cargo build --release`
The binary will be at `target/release/grammar-lsp`

Create a test file with some content that you would like to check for grammar or spelling errors.(Ideally with some errors)

Now in order to test, we need an editor. I will show how it would look like for neovim. But you can use any editor/IDE for that matter. You might need to adjust the client side integration as per your editor's expected language/format.

### Neovim Integration
Create a lua file(`init.lua`). For now, place it in the lsp project directory for simplicity.

Conceptually, what you need on the client side is:
- Start the LSP client.
- Attach the LSP client to the buffer.

```Lua

-- 0. Setup the paths
local lsp_path = vim.fn.fnamemodify(debug.getinfo(1, 'S').source:sub(2), ':p:h')
local binary_path = lsp_path .. '/target/release/grammar-lsp'
-- 0. [Optional] create a custom log file, otherwise it will log in `~/.local/state/nvim/lsp.log`
local log_file = lsp_path .. '/grammar-lsp.log'

-- 1. Start LSP client
local client = vim.lsp.start_client({
  name = 'grammar-lsp',
  cmd = {'sh', '-c', binary_path .. ' 2>' .. log_file},
  filetypes = {'markdown'}, -- only for markdown, but you can add multiple patterns
  root_dir = vim.fn.getcwd(),
})

-- 2. Auto-attach to markdown buffers
vim.api.nvim_create_autocmd('FileType', {
  pattern = 'markdown',
  callback = function()
    vim.lsp.buf_attach_client(vim.api.nvim_get_current_buf(), client) -- attaching the client to the current buffer
  end,
})
```

### Test
- Open your test file: ***`nvim test.md`***
- Inside neovim, load the config ***`:luafile ./init.lua`***
- Run ***`:LspInfo`***, This should show that the grammar-lsp is attached to buffer.
- Edit something and save the file to trigger grammar check
- You should see warnings appear for errors. **Depends on how fast LLM responds**

{{< figure src="./grammar_lsp.png" alt="Grammar LSP Demo" caption="Figure 5: Grammar LSP showing warnings" >}}

### Debugging
A few things I have found useful while debugging in case something doesn't work:

- In a separate terminal, tail the log file: `tail -f grammar-lsp.log`. You should see something like this:
```
  [Grammar Check] Starting check for 123 bytes
  [Grammar Check] Calling Ollama API...
  [Grammar Check] Found 3 issues
```
- Also if you want to add more logs, remember to log in stderr(eprintln!).
- Use `:LspInfo` to check if the server is attached to a buffer.
- Common Ollama issues
    - ensure ollama is running: `ollama serve`
    - ensure the model is available: `ollama pull <model_name>`
    - If local model is taking too long:
        - Increase timeout.
        - Use a smaller model.
    - Smaller models might not work well with structured output. I have tried gemma 1b. It outputs malformed json far too often. Also the core grammar check capability was also ineffective. I have found 4b a nice balance.


### Recap
Let's recap what we built:

1. LSP Layer(`main.rs`): Handles protocol and implements LSP methods - initialize, document sync, publishing diagnostics.
2. Provider Layer(`grammar_client.rs`): Encapsulate grammar checking logic - HTTP, parsing, error handling. 
3. Data Layer(`ollama.rs`): Type definitions for requests/responses.

You can swap out the ollama provider to any LLM provider of your choice. the LSP layer stays the same - It just calls `check_grammar()` and publishes whatever comes back.

**See the full code in the [github-repo](https://github.com/trifiasco/grammar-lsp)**

### Next Steps
Here are a few things you could try from here:
- Update document synchronization from FULL to INCREMENTAL.
- Add caching - hash document content, skip LLM call if unchanged.
- Add configurable model, timeout, severity.

In terms of features, here are few ideas to try:
- TODO comment linter: finds `//TODO:` reports as diagnostics.
- You can extend for some other filetypes - e.g., JSON formatting/linting errors as diagnostics.
- Add code action capability to apply grammar fixes.

## Personal Notes
- I initially wanted to implement the code navigation features like `Go to definition` with full semantic analysis. Turns out, it's not as easy as I thought. Perhaps someday!
- Learned that logs go to `stderr`. Wasted a lot of time figuring out why I wasn't seeing any logs. 
- I learned about LSPs almost 6 years ago and have been using/configuring/maintaining LSPs in neovim for about the same amount of time. Yet I have learned more about LSPs while writing this article than I learned in the prior years.

