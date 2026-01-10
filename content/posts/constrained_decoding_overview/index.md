---
title: "Introduction to Constrained Decoding"
date: 2026-01-09T17:11:01+01:00
draft: false
slug: "constrained-decoding-intro"
tags: ["llm", "structured-output", "constrained-decoding"]
categories: ["LLM"]
description: "Comprehensive overview of different techniques to ensure structured output from LLM - focusing on constrained decoding"
toc: true
---

While writing the [LSP article](/posts/lsp-deep-dive), I noticed that smaller models continuously failed to output in the expected structure. It was especially prone to producing malformed JSON that caused parsing errors and downstream failures. I wondered, how people deal with this kind of situation where we expect a specific structured output from LLMs, as I suspect this is a very common scenario and there must be a proper way to handle this. This led me down this rabbit hole and I learned a lot about structured output and more importantly, the constrained decoding technique, which I found very interesting. This article is an introductory overview of how to make LLMs conform with the expected structured output.

## LLM Structured Output

Structured Output refers to when you expect responses from LLM that conform to specific structure (e.g., JSON, XML, SQL) instead of free-form text.

Because LLMs are essentially next-token prediction systems, without any guardrails or mechanisms to ensure structured output, you will find that more often than not they have a hard time generating output that conforms to a predefined structure/schema, especially if the expected output structure is complex.

The problem with malformed output is - you will have parsing errors causing broken workflow, tool call failures and such. Especially, as more and more complex workflows are being built with LLM responses in its core, a crucial part would be to ensure proper structured output to avoid cascading failures.


## Few Imperfect Solutions

There have been a few approaches to ensure LLM outputs conform to a predefined structure, with varying degree of effectiveness:

1. **Few shot prompt engineering**: The idea here is to provide a well crafted prompt with:
    - *Few-shot examples*: Show the model 2-3 examples of desired output
    - *Explicit format instructions*: "Respond in JSON format with `<fields>` and `<formats>`"
    - *XML tags for structure*: Use `<data>`, `<instructions>`, `<output>` to organize the prompt

    ***Results:*** This doesn't guarantee 100% compliance, but improves reliability. Overall effectiveness varies depending on:
    - Model: More capable and high end models perform more reliably than smaller ones.
    - Task Complexity: How complex is the schema or the overall task. Also the nature of task matters too. For example narrative style task performs worse.
    - Retry: Incorporating retry mechanism has reported increased reliability.


2. **Fine-tuning:** The idea here is to do post-training on lots of structured output examples, so that the model calibrates itself for generating structured output.

    ***Results:*** Reduces prompt tokens but still not 100% reliable. Plus fine-tuning adds a cost overhead.

3. **Post-processing/Parsing:** The idea is to add retry loops, partial JSON repair, schema validation etc.

    ***Results:*** Again not 100% reliable. It varies on model, implementations. More importantly it adds latency and cost, making it not optimal.


> The **[Instructor](https://python.useinstructor.com/)** python library combines few shot prompt engineering along with configurable retry loops. It converts Pydantic models to prompt instructions, validates LLM responses, and retries on validation failures.
> This library reportedly achieves very high accuracy with modern models.

**Bottom Line:** None of the above mentioned techniques could reliably guarantee 100% compliance with reported effectiveness in the range of 70-95%.

## Constrained Decoding
Constrained Decoding is a technique to manipulate token generation at inference time to guarantee format compliance.

The core idea is to compute which tokens are valid given the current state and required structure. Invalid tokens are masked (i.e., their probability is set to zero or negative infinity) before sampling. *This makes it impossible to generate non-compliant output.*

**Key insight**: By design it is 100% schema compliant as we will invalidate tokens that are not allowed during the generation process.

## How it works

### LLM token prediction refresher
First, let's review how the token generation process happens in LLM:

- **Logits generation**: LLM processes an input and produces a vector of logits for every token in its vocabulary (typically 50k+). Logits are unbounded raw numerical values indicating confidence/preference for each token as the next token.
- **Softmax transformation**: Logits are then passed into a Softmax function, which squashes them into a probability distribution where all values sum to 1.
- **Sampling**: A sampling technique like greedy decoding or temperature sampling uses these probabilities to select the final token as the next token.

### Masked Decoding
Constrained decoding applies a binary mask to the output logits, marking which tokens are allowed or not. Following image illustrates the masked token generation process -

{{< figure src="./masked_decoded_generation.png" alt="LLM generation with masked decoding" caption="Figure 1: Text generation with masked decoding" >}}


So at a high level, we look at what has been generated and what the required structure is. Then we only sample from the tokens that will ensure the structure conformity.


{{< figure src="./constrained_decoding.png" alt="Constrained Decoding" caption="Figure 2: Structure conformity" >}}

### Implementation approaches

The core part of any constrained decoding implementation is how it tracks the generated state and the required structure to produce the binary mask. There are a few different approaches for this.

- **Finite State Machines (FSM):** Compiles schema into [FSMs](https://en.wikipedia.org/wiki/Finite-state_machine) that track current state and determine valid next tokens. FSMs are computational models that represent a finite number of states and possible transitions between states. Suitable for simpler structures.


- **Context Free Grammars (CFG):** [CFG](https://en.wikipedia.org/wiki/Context-free_grammar) uses a set of recursive rules (production rules) to define the structure of a language. Typically CFGs are used via Push Down Automata ([PDA](https://en.wikipedia.org/wiki/Pushdown_automaton)), which is a state machine like FSM with a core difference that it has a stack of memory it can access and update. And any transition depends not only on current state and input like FSM, but also on the symbol on top of the stack. Suitable for complex structures, recursive fields.

Let's look at a simplified implementation of how masking is generated from a predefined schema with a simplified FSM.

Assume this is our schema with two properties (name and age), one string and one integer:
```python
schema = {
  "type": "object",
  "properties": {
      "name": {"type": "string"},
      "age": {"type": "integer"}
  }
}
```
So this would be a valid structure conforming the above schema:
```JSON
{
    "name": "arnab",
    "age": 30
}
```

What we want to implement is given the following generated text, we want to produce a binary mask where only numbers are allowed:
```JSON
{
    "name": "arnab",
    "age": 
}
```

#### Step 1: Schema to Regex
The first step is to convert the JSON schema into Regex. Here's a simplified implementation. For real projects with complex structures, we would use libraries like [interegular](https://pypi.org/project/interegular/):
```python
def schema_to_regex(schema: Dict) -> str:
  if schema.get("type") == "object":
      properties = schema.get("properties", {})
      patterns = []
      for key, value_schema in properties.items():
          if value_schema.get("type") == "string":
              patterns.append(f'"{key}"\\s*:\\s*"[^"]*"')
          elif value_schema.get("type") == "integer":
              patterns.append(f'"{key}"\\s*:\\s*\\d+')

      # Build full JSON object pattern
      inner_pattern = "\\s*,\\s*".join(patterns)
      return f"\\{{\\s*{inner_pattern}\\s*\\}}"

  return ""
```
You can call the `schema_to_regex` function like this:
```python
schema = {
  "type": "object",
  "properties": {
      "name": {"type": "string"},
      "age": {"type": "integer"}
  }
}

# Step 1: Schema -> Regex
regex_pattern = schema_to_regex(schema)
print(f"Regex pattern: {regex_pattern}")
# It will print the converted Regex pattern like following:
# > Regex pattern: \{\s*"name"\s*:\s*"[^"]*"\s*,\s*"age"\s*:\s*\d+\s*\}
```

#### Step 2: Regex to FSM
Next step is to build an FSM to maintain a state machine that will check a text against the compiled regex pattern and return valid transitions.

```python
class SimpleFSM:
  def __init__(self, regex_pattern: str):
      self.pattern = regex_pattern
      self.compiled_regex = re.compile(regex_pattern)

  def get_allowed_next_chars(self, current_text: str) -> Set[str]:
      allowed = set()
      # Test each possible next character
      test_chars = list('abcdefghijklmnopqrstuvwxyz0123456789"{}: ,')
      for char in test_chars:
          test_str = current_text + char
          # Check if this could be a valid partial match
          if self._is_valid_prefix(test_str):
              allowed.add(char)

      return allowed

  def _is_valid_prefix(self, text: str) -> bool:
      # Simple heuristic: try to match partial string
      # Real implementations use DFA state transitions
      try:
          # Check if any string starting with this prefix could match
          pattern = f"^{re.escape(text)}"
          return bool(re.search(pattern, self.pattern)) or self.compiled_regex.match(text + "}" * 10)  # Simplified check
      except:
          return False

fsm = SimpleFSM(regex_pattern)
current_generation = '{"name": "arnab", "age": '
allowed_chars = fsm.get_allowed_next_chars(current_generation)
print(f"Allowed next characters: {allowed_chars}")
# > Allowed next characters: {'4', '1', '9', '7', '3', '8', '2', '5', '6', '0'}
```

Not to mention this is very simplified. Ideally the state machine would have a mapping for state transition. But to illustrate my point, here's what's happening:
- We initialize the `SimpleFSM` with the regex pattern we got from Step 1.
- `SimpleFSM` compiles the regex pattern
- `get_allowed_next_chars` method takes currently generated text as parameter. Then it tries to append one character at a time `test_str`. (This in a real project would use a transition map instead of trying all possible characters)
- We call `_is_valid_prefix` method to validate whether `test_str` could be a valid structure. (Again this is overly simplified, I am adding an arbitrary number of close curly braces and trying to regex match)
- What we get in return is a set of characters with only digits as allowed characters. Because age is expected to be an integer.

#### Step 3: Create binary token mask
Finally we will have to produce a binary mask array for allowed tokens. Ideally you would use a `Tokenizer` for vocabulary, but I will use a sample vocabulary containing lowercase letters, digits and few JSON punctuation characters.

Our vocabulary: `abcdefghijklmnopqrstuvwxyz0123456789"{}: ,`

And the token masker would look like this:
```python
class TokenMasker:
  def __init__(self, fsm: SimpleFSM):
      self.fsm = fsm
      # example vocabulary: [abcdefghijklmnopqrstuvwxyz0123456789"{}: ,]
      self.vocab = [chr(i) for i in range(97, 123)] + [str(i) for i in range(10)] + ['"', '{', '}', ':', ',', ' ']
      self.vocab_size = len(self.vocab)

  def get_token_mask(self, current_text: str) -> List[bool]:
      mask = [False] * self.vocab_size

      # Get allowed next characters from FSM
      allowed_chars = self.fsm.get_allowed_next_chars(current_text)

      # Update Mask for each allowed token in vocabulary
      for token_id in range(self.vocab_size):
          token_str = self.vocab[token_id]
          if token_str and token_str[0] in allowed_chars:
                  mask[token_id] = True
      return mask

masker = TokenMasker(fsm)
current_generation = '{"name": "arnab", "age": '
mask = masker.get_token_mask(current_generation)
print(f"Token mask: {mask}")
# You will see only the indices for digits are set to True
# > Token mask: [False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, False, True, True, True, True, True, True, True, True, True, True, False, False, False, False, False, False]
```

For real world implementations, you can take a look at following repositories:
- [Outlines GitHub](https://github.com/dottxt-ai/outlines) - Regex and FSM based implementation
- [XGrammar GitHub](https://github.com/mlc-ai/xgrammar) - CFG and PDA based implementation


## Notes on Quality and Performance
While constrained decoding will ensure 100% syntactic compliance with the expected structure, it might drive models away from preferred tokens, potentially reducing semantic quality.

Also the key order in JSON affects generation quality due to the sequential nature of generation.

On performance side, deeply nested or recursive structures increase mask computation overhead.

## How do you use it?

### Commercial Models with API
If you are using any cloud or enterprise model provider, almost all of them as of writing this article (Jan 2026) support native constrained decoding for structured output generation. Although with varying degrees of support. See the table below for more information:

| Provider | Feature | Guarantee | Notes |
|----------|---------|-----------|-------|
| **OpenAI** | Structured Outputs | 100% schema compliance | `strict: true` in function definitions; OpenAI claims 100% compliance and reports gpt-4o scores perfect on their internal evals |
| **OpenAI** | JSON Mode | Valid JSON only | No schema guarantee; deprecated in favor of Structured Outputs |
| **Anthropic** | Structured Outputs (Beta) | Schema compliance | `strict: true` + beta header; available for Claude Sonnet 4.5+ |
| **Anthropic (via Bedrock)** | Tool Use | High reliability (not constrained) | Tool calling uses prompt training, NOT constrained decoding; reliability similar to Instructor approach (95%+ range) |
| **Google** | Function Calling | Schema compliance | Via Gemini API |
| **AWS Bedrock (Nova models only)** | Native Constrained Decoding | 100% schema compliance | Automatic grammar generation from tool schemas; guarantees syntactically valid JSON; overall tool use accuracy ~95% due to semantic errors ([AWS blog](https://aws.amazon.com/blogs/machine-learning/structured-outputs-with-amazon-nova-a-guide-for-builders/)) |
| **AWS Bedrock** | Custom Model Import | 100% schema compliance | Real-time constrained generation for imported models |

### Self hosted or custom inference
If you are hosting models yourself and using inference engines like vLLM, SGLang, you have a few options on how you can add constrained decoding to your inference engine.

See the following tables for major libraries and implementations of constrained decoding and integration with inference engines:
#### Major Libraries and Implementations

| Library | Developer | Key Features | Performance |
|---------|-----------|--------------|-------------|
| [**Outlines**](https://github.com/dottxt-ai/outlines) | dottxt | FSM-based, regex/JSON schema, widely integrated | O(1) token lookup, but token-by-token state transitions |
| [**Guidance**](https://github.com/guidance-ai/guidance) | Microsoft | Python DSL for constraints, token-level control, KV-cache optimization | faster inference on some benchmarks |
| [**LLGuidance**](https://github.com/guidance-ai/llguidance) | Microsoft | Rust core for speed, CFG support | ~50us per token for 128k tokenizer |
| [**lm-format-enforcer**](https://github.com/noamgat/lm-format-enforcer) | Noam Gat | JSON Schema + Regex, beam search support | Flexible whitespace/ordering |
| [**XGrammar**](https://github.com/mlc-ai/xgrammar) | MLC/CMU | Context-independent token precomputation, PDA-based | Up to 100x speedup, <40us/token |


#### Inference Engine Integration

| Engine | Default Backend | Notes |
|--------|-----------------|-------|
| **vLLM** | XGrammar (or Outlines, Guidance) | sequential mask generation |
| **SGLang** | Compressed FSM | Jump-forward decoding; overlaps mask generation with inference; 2-2.5x faster than alternatives |
| **TensorRT-LLM** | XGrammar | NVIDIA optimized |
| **llama.cpp** | GBNF grammars | Native grammar support |


## Personal Notes
- Major commercial model providers are supporting it out of the box or at least moving towards that direction as far as I can see.
- I have seen recommendation to use constrained decoding alongside few shot prompt engineering for maximum reliability and quality.
- For most use cases I think using the [Instructor](https://python.useinstructor.com/) with a high end model would be sufficient.
- [This paper](https://guidance-ai.github.io/llguidance/llg-go-brrr) on LLGuidance has some really cool optimization tricks. I hope to dive deep into it someday!
