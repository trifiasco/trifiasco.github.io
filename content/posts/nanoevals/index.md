---
title: "nanoevals: What goes into LLM evals"
date: 2026-04-05T13:46:45+02:00
draft: false
slug: "nanoevals"
tags: ["llm", "evals", "ai-agents", "python"]
categories: ["Programming", "Evals", "LLM"]
description: "I built a minimal eval library to understand exactly what goes into the end-to-end evaluation process"
toc: true
---

In my [previous article](/posts/llm-agent-evals), I tried to compile the theories around LLM and agent evaluations. It gave me a good understanding of the process but there were still a few open questions and/or concerns around what it looks like in practice. 

So as a follow up, I wanted to build a minimal reference implementation of an end to end eval process to understand the core parts of evals a bit more in depth. [nanoevals](https://github.com/trifiasco/nanoevals) is my attempt at that.

It's small and minimal yet covers (almost) all the moving parts under ~700 lines of python code (core logic is ~300 lines, the rest is cli and streamlit app wiring).

This article is about the implementation, design choices, what I left out and why.


## What purpose it serves

Well, the primary purpose it serves is to provide clarity on what exactly goes into the evaluation process and how all the individual parts fit together. Stripping everything to only the essentials gives a clear lens into what's actually load bearing and what's just implementation detail.


## Constraints

Before I started, I set a few constraints for myself:

- as minimal as possible both in terms of LoC and features.
- avoid external libraries/dependencies as much as possible.
- be extensible.

Initially my plan was to stay under 500 lines. I failed, but with good reasons (see the [Entrypoints](#entrypoints) section below).

In terms of external dependencies, I only used `pydantic` and `pyyaml` in the core logic. I think it's fair. `pydantic` gives a few QoL improvements in terms of managing types. And `pyyaml` provides easier handling of YAML files (used for managing golden datasets). Without it, I had to manually handle file loading and/or parsing, which I didn't want to do.

One more thing that I didn't plan initially but later adopted was a streamlit app as an additional entrypoint alongside CLI. As much as I like CLIs, I think the streamlit app serves a critical need: dataset management and report overview. More on this in the [Entrypoints](#entrypoints) section.

## Architecture

If you recall the [previous article](/posts/llm-agent-evals), there are three layers of evaluation:

- what you evaluate: the agent
- how you grade: deterministic and subjective checks
- what grounds everything: the dataset

nanoevals covers all three. The architecture is conceptually very simple:


- **BYOA**: you bring your agent to evaluate.
- **metrics and judge**: metrics represent deterministic criteria for evals and judge (or llm-as-a-judge) represents the subjective criteria. Together these form the grading logic or how you evaluate.
- **dataset**: datasets are defined and managed in YAML files, where you define test cases with input and expected output. This is what grounds everything.
- **eval runner**: a module that reads the dataset and runs the test cases against the defined criteria (deterministic or subjective). It produces results in a report-like manner containing scores per metric, latency, usage, and CI gate threshold checks.

{{< figure src="./arch_overview.png" alt="nanoevals architecture overview" caption="Figure 1: Architecture Overview" >}}

### Design choices

- **YAML for dataset**: It serves two purposes: a. it's human readable and easy to version control/edit by a non-technical SME and dev alike, and b. easier to manage compared to in-code pytest-like assertions.
- **metrics are extensible**: I added three default metrics to showcase the concept, but one can bring their own metrics to evaluate against. (See [examples/custom_metrics.py](https://github.com/trifiasco/nanoevals/blob/main/examples/custom_metrics.py))
- **callable agent_fn and judge_fn**: both judge and agent are wired up as callables. It keeps things simple on the eval implementation side by having no tight coupling and/or config management. You bring the agent and judge, nanoevals just calls them to get the responses.
- **no OTel wiring**: If you recall the [previous article](/posts/llm-agent-evals), setting tracing and telemetry is a prerequisite. But I leave it up to agent implementation side. nanoevals expects the agent implementer to wire the OTel and send the tracing to the eval library. It keeps things simple. 
- **repeat parameter**: It runs the full dataset multiple times and reports pass rates and consistency across runs, useful for measuring reliability.

### Entrypoints

nanoevals provides two entrypoints, a CLI and a streamlit app. Both call the runner and show the results in a report-like manner.

{{< figure src="./entrypoints.png" alt="nanoevals entrypoints" caption="Figure 2: Entrypoints" >}}

My initial thoughts and implementation was only about CLI. It serves the purpose and easy to run in CI. But a critical part of the eval process is dataset management, especially by non-technical SMEs/stakeholders. Streamlit shines in this case. It provides a visual interface to view reports and manage datasets. I think it's pretty cool.


{{< figure src="./Screenshot_Dataset_Editor.png" alt="nanoevals streamlit dataset editor" caption="Figure 3: Streamlit dataset editor" >}}

{{< figure src="./Screenshot_Reports.png" alt="nanoevals streamlit reports" caption="Figure 4: Streamlit reports" >}}

Although this comes with a cost. The streamlit app is the most heavy part of the codebase with ~190 LoC. Without it, I would've maintained my initial constraints of ~500 LoC. But I think it provides significant values to ignore the constraint.

That being said, the streamlit implementation is very rough. But again, it's for illustration and it's not meant to be production ready.

### Judge calibration

The CLI provides a judge calibration endpoint. It computes TPR and TNR and provides an overview of the judge's efficacy. To be fair, this was an afterthought, **This could seriously be improved**. 

Currently, the whole thing revolves around agent's evaluation and not so much about judge calibration. But the implementation does have the necessary data structures for judge datasets and it's easily extensible I think.

## Contract Signatures

Provide your agent, judge, and custom metrics as functions:

```python
def my_agent(input: str) -> Trace:
    ...

def my_judge(trace: Trace, test_case: AgentTestCase) -> list[EvalResult]:
    ...

def my_metric(trace: Trace, test_case: AgentTestCase) -> EvalResult:
    ...

dataset = load_agent_dataset("my_tests.yaml")
report = run_eval(
    dataset,
    agent_fn=my_agent,
    judge_fn=my_judge,
    extra_metrics=[my_metric],
)
```

Async agents are supported transparently — just pass an `async def` agent and `run_eval` handles it automatically, running test cases concurrently with `asyncio.gather`:

```python
async def my_agent(input: str) -> Trace:
    result = await call_llm(input)
    return Trace(output=result, ...)
```

## How to read the codebase

Core modules:
- [dataset.py](https://github.com/trifiasco/nanoevals/blob/main/nanoevals/dataset.py): provides schema for dataset and contains loader functions
- [types.py](https://github.com/trifiasco/nanoevals/blob/main/nanoevals/types.py): provides type definitions for tool calls, tracing, usage stats, eval result
- [metrics.py](https://github.com/trifiasco/nanoevals/blob/main/nanoevals/metrics.py): provides reference implementation of how a deterministic metric should work. Takes in trace(actual output) vs test_case(expected output from dataset) and computes scores.
- [runner.py](https://github.com/trifiasco/nanoevals/blob/main/nanoevals/runner.py): runs each test case from the dataset against defined metrics and produces results.

Supporting modules:
- [cli entrypoint](https://github.com/trifiasco/nanoevals/blob/main/nanoevals/cli.py)
- [streamlit entrypoint](https://github.com/trifiasco/nanoevals/blob/main/nanoevals/app.py)
- [ci gate](https://github.com/trifiasco/nanoevals/blob/main/nanoevals/gate.py): computes CI gate pass/fail from predefined thresholds.

## Limitations

There are some serious limitations, but I have deliberately chosen to leave these out. Given the goal is to optimize for clarity over completeness, I think it's an acceptable tradeoff.

- **Metrics are intentionally shallow**: No BLEU, ROUGE, or BERTScore. Built-in metrics show the pattern; bring your own for production use.
- **No tracing annotation**: One important part of the evaluation process to review real traces and annotate them as part of the error analysis loop. But as mentioned above, I have decided to leave the whole tracing handling to the agent implementer.
- **No built-in LLM judge**: You bring your own `judge_fn`. The library stays dependency-free and LLM-agnostic.
- **No retry/backoff**: Flaky agent calls are caught but not retried. As a workaround, one could handle retries in your `agent_fn`.
- **No run comparison**: You can only view individual runs in the dashboard. I think comparing with previous runs with diffing `report.json` files for regression tracking would be a nice addition.
- **No dataset versioning or synthetic generation**: YAML files + the editor cover basic management. This could be easily extended, but I chose not to.

So in short, please don't use it in production :P It's not supposed to be a library you adopt, rather you try it out and read the code to understand the moving parts.

## Personal Notes

Personally I learned a lot with this exercise. A lot of the open questions and concerns in the [previous article](/posts/llm-agent-evals) are now clearer.

I mentioned in the previous article that structured output should help with evaluation. This proves that, if the agent produces structured output, you can easily incorporate those in the dataset and check against each field instead of fuzzy matching (I did include a fuzzy reference matching metric, which is kind of proving the point by negation that it's harder to test against prose)

Question around running evals in CI is much clearer, but the question of running them cheaply still remains. As calling the agent/LLM is still a requirement. Need to figure this out.

The big revelation was of course dataset management with YAML. I think it's pretty neat.

Obviously there are more to learn. But I am making good progress :D
