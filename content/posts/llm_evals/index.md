---
title: "A Synthesis of LLM Evaluation"
date: 2026-03-15
draft: false
slug: "llm-agent-evals"
tags: ["llm", "evals", "ai-agents", "testing", "python"]
categories: ["Programming", "Evals", "LLM"]
description: "I spent a few weeks going deep on LLM evaluation practices. This is my synthesis: the three-layer eval stack, LLM-as-a-Judge, error analysis as a development methodology"
toc: true
---

I have been reading a ton about LLM evaluation practices over the past few weeks from [Anthropic's engineering blog](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [Hamel Husain's practitioner-focused guides](https://hamel.dev/blog/posts/evals/), the [Evals for AI Engineers book](https://learning.oreilly.com/library/view/evals-for-ai/9798341660717/) by Shreya Shankar and Hamel Husain, and several eval framework docs. I wanted to write what I learned and have a synthesis of my understanding of the topic.

This is in no way comprehensive, rather it's my personal reference piece on the topic.


**TL;DR:**

- **Observability first.** You cannot evaluate what you cannot observe. Add tracing from day one.
- **Deterministic checks are unit tests for agents.** Write them as you build, not after.
- **Three-layer eval stack:** what you evaluate (the agent), how you grade (deterministic checks, LLM-as-a-Judge, humans), and what grounds it all (datasets).
- **Use Error Analysis as the development methodology.** The core development loop. The agent, judge, and datasets co-evolve through the same loop.
- **Start with 20-50 cases** focused on known failures. Use binary pass/fail over Likert scales. Never stop reading traces.

## Why Evals Matter

Evals are the testing mechanism for LLM powered applications. Without evals, every change to a prompt, model, or retrieval pipeline could improve one thing and quietly break three others. Evaluation provides a concrete way to establish a baseline and measure system efficacy and reliability.

This is similar to having tests as part of the traditional production software systems, with the natural evolution to cater to the non-deterministic nature of LLMs.

## Terminology Quick Reference

Different frameworks, docs, articles use different names for the same concepts. This tripped me up during research. Here's my attempt to reconcile these:

| Concept | Anthropic | pydantic-evals | OpenAI |
|---------|-----------|----------------|--------|
| Single test scenario | Task | `Case` | Test case |
| Collection of test cases | Dataset / Eval Suite | `Dataset` | Eval |
| One execution attempt | Trial | single run of `evaluate` | Run |
| Scoring logic | Grader | `Evaluator` | Grader |
| Execution record | Transcript / Trace | `span_tree` | Trace |
| Known correct answer | Reference Solution | `expected_output` | Expected |
| Run infrastructure | Eval Harness | `dataset.evaluate_sync()` | Evals Platform |

**Key differences:** Anthropic emphasizes running the same task multiple times (pass@k) and trial isolation. Pydantic-evals runs each case once by default and provides `span_tree` via OpenTelemetry for trajectory access. Isolation depends on your implementation in most frameworks.


## Core Concepts

Let's clarify some of the concepts and terminologies first for better comprehension:

### What You're Evaluating (The Agent)

The Agent is the system under test. We would ideally want to evaluate it on multiple axes:

- **output quality**: is the final answer correct?
- **tool use**: did it call the right tools with the right parameters?
- **trajectory**: did it take a sensible path to the answer?
- **interaction**: in case of multi-turn interaction we want to preserve coherence, memory retention across turns and recover from errors. 
- **cost**: all the while, we want to keep an eye on token usage, latency, and other operational costs.
- **planning**: in some cases, it's also a good idea to evaluate intermediate reasoning, planning and self-reflections.

> **One important nuance on trajectory evaluation.** There is a natural instinct to check that agents followed very specific steps. Anthropic warns against this: if it is too rigid, it might discourage novel/interesting discoveries that might emerge. The better approach (and the consensus across everything I read) is to grade what the agent *produced* (postconditions), not the exact *path* it took. Reserve trajectory checks for safety invariants (forbidden tools) and critical ordering constraints (e.g., auth before write). For everything else, trajectory is informational.

Evaluation strategy could be grouped into two different categories:

- **capability evals**: "does this agent do X well?", with scores that start low and climb
- **regression evals**: "does it still do X as well as before?", which should stay at 100%.

I think this could help in preparing monitoring/observability metrics and dashboards. Grouping different test cases in the above categories will help quickly measure and observe overall system performance and degradations.


### How You're Evaluating (The Grading Pipeline)

There are three types of evaluation mechanisms:

1. **Deterministic graders** (code-based) - This should be the foundation of any evaluation strategy and used as much as possible. These are essentially "unit tests" like checks.

    For example, an agent that produces an Excel from a source data, we can easily assert how many rows/columns the Excel should have or does the Excel schema match the expected schema. These are essentially cheap, fast, reproducible, and CI-friendly checks. Key thing to remember here - **If you can write a code check for it, do not use an LLM judge.**

    > A good question someone asked me when I was presenting this idea was "In a CI environment, you would still have to call an LLM to get the agent output, then it's not really a unit-test like thing, because stubbing the LLM call doesn't actually test the agent, because the response is what we are trying to test and the response is not deterministic that we can just mock"

    > I think that's a fair question, we need to call the model inference to get the agent response. But I think we can reduce the inference call by reusing a response to test multiple checks at once. We don't necessarily need to call LLM for every test. Although a pass@k or pass^k mechanism would require multiple calls. More on this later.

2. **LLM-as-Judge** (model-graded) - This is useful for evaluating subjective dimensions only. Coherence, helpfulness, tone, reasoning quality. More on this [below](#llm-as-a-judge).

3. **Human graders** - This is last line of evaluation and used for calibration, edge cases, and validating the other two. Expensive but essential as the root of trust.


For scoring, deterministic graders act as binary gates (all must pass). The LLM judge contributes a weighted score:

```python
def compute_final_score(deterministic_results: list[bool],
                        summary_judge_pass: bool) -> dict:
    if not all(deterministic_results):
        return {"pass": False, "reason": "deterministic_failure"}

    return {
        "pass": True,
        "summary_quality": "PASS" if summary_judge_pass else "FAIL",
        "overall_score": 1.0 if summary_judge_pass else 0.8,
    }
```

### What Grounds Everything (Datasets)

Two distinct datasets serve two distinct purposes:

| Dataset | Structure | Purpose |
|---------|-----------|---------|
| **Agent eval dataset** | `(input, expected_output)` pairs | Measures agent quality |
| **Judge calibration dataset** | `(agent_output, human_quality_label)` pairs | Measures judge accuracy |

These are **different datasets**. The agent eval dataset answers **"is my agent good?"** The judge calibration dataset answers **"is my judge trustworthy?"**.

> The `expected_output` is not limited to exact string matches. It can be structured data for multi-axis scoring, a natural-language reference for an LLM judge, or a verification function.

> Someone recently told me, when you are building agentic systems, eval dataset and harness is your moat. It's easy to hook up an LLM, a few tools and run these in a loop and you have an agentic system. Anyone can build this. What differentiates is the curation of the eval datasets, harness that graduates an impressive prototype to a reliable production system 

## Development Loop

In broad strokes, adding and maintaining evals in an LLM powered application is as follows:

1. **Analyze** - examine traces to find where the system fails
2. **Measure** - build targeted evaluators that quantify those failures
3. **Improve** - experiment with changes (prompts, models, retrieval strategies)
4. **Automate** - turn confirmed fixes into regression tests that prevent backsliding

Each rotation makes your system more reliable, increases efficacy and helps to quantify both.

This is not the only `development loop` for evals though. The [Evals for AI Engineers book](https://learning.oreilly.com/library/view/evals-for-ai/9798341660717/) recommends a different albeit similar approach called **Error Analysis**

### Error Analysis: The Core Development Loop

This seems the most comprehensive way from what I can gather. But be aware that this process is very involved.

This is a **development methodology** for AI agents. Everything else (datasets, judges, prompts) grows out of this loop.

### The Workflow

```
1. Collect traces (~100, both successes and failures)
2. Annotate (human reads each trace, notes failures — no LLMs here)
3. Cluster (group annotations into failure modes)
4. Act (fix agent, refine judge, expand datasets)
5. Verify (run evals to confirm fixes)
→ Repeat
```

**Collect:** Each trace should capture the input, all tool calls, intermediate reasoning, and final output. Observability infrastructure is a prerequisite; without traces, meaningful error analysis is impossible.

**Annotate:** One (or multiple) human SME reads each trace carefully, writing brief notes about anything surprising, incorrect, or wrong-feeling. **No LLMs in this step.** The goal is to find patterns, not just individual failures.

**Cluster:** Group similar annotations into coherent failure modes (e.g., "hallucinated tool calls", "lost context after 5 turns", "wrong tool for date queries"). LLMs can help with initial clustering, but humans must validate. Typically 2-3 rounds to stabilize the taxonomy.

**Act:** For each failure mode, triage: **is this an agent problem, a judge problem, or a dataset gap?** In turn, you adjust prompts, tools and/or eval rubrics/criteria.

Every failure discovered during error analysis feeds **all three** components simultaneously, where each pass improves the agent, the judge, and the datasets together.

Roughly:
**Agent Problem**: Adjust the agent prompt, tools.
**Judge Problem**: Adjust judge rubrics/criteria.
**Dataset Problem**: Add and/or update tests.


## LLM-as-a-Judge

This is a broad topic and quite interesting, not to mention the most nuanced. It's useful to test subjective qualities of an agent's responses.

The consensus across practitioners is clear: use LLM judges **only for qualities that resist reduction to code checks**. They should **NOT** be used for:

- Format/schema validation or length constraints (use code)
- Exact match requirements or regex-matchable patterns (use code)
- Code correctness (use unit tests)
- Factual verification without reference context (the judge will hallucinate evaluations)
- Specialized domains (medicine, law, finance) without grounding material
- Cases requiring strict reproducibility (the judge itself is non-deterministic)

### Rubrics and Dimensions

A "rubric" is the instruction text given to the LLM judge defining how to assess a dimension. Dimension = *what* you grade. Rubric = *the grading criteria sheet*. For example:

- **Dimension:** "helpfulness"
- **Rubric:** *"The response must: (1) directly address the user's question, (2) provide at least one actionable next step, (3) not require follow-up questions for basic info. PASS if all three are met. FAIL if any is not met."*

**Key design principle from the sources:** Use **pass/fail judgments** over point ratings. Likert scales (1-5) produce inconsistent, unactionable results. Instead of one judge rating "quality: 3/5", decompose into **multiple focused binary judges**, each with their own rubric (accuracy: PASS/FAIL, groundedness: PASS/FAIL, completeness: PASS/FAIL). Far more actionable. The judge model should be at least as capable as the model being evaluated and should return structured output (JSON with score, reasoning, citations).

For example, for a data cleaning agent, the summary quality judge looks like this:

{{< code lang="python" filename="summary_judge.py" >}}
@dataclass
class SummaryQualityJudge(Evaluator[dict, dict, None]):
    RUBRIC = """
    Evaluate the human-readable summary produced by a data cleaning agent.
    You have access to the structured change log and the agent's summary.

    Criteria:
    1. ACCURACY — Every claim must match the structured change log.
       Must include SPECIFIC COUNTS for quantitative operations.
       Vague statements like "removed duplicates" without counts are a FAIL.
    2. COMPLETENESS — All major operations must be mentioned.
    3. CLARITY — Understandable to a non-technical user.

    PASS if all three criteria are met.
    FAIL if any is not met — explain which and why.

    Respond in JSON: {"score": "PASS" or "FAIL", "reasoning": "..."}
    """

    def evaluate(self, ctx: EvaluatorContext[dict, dict, None]) -> bool:
        # Call LLM with self.RUBRIC, the agent's summary, and the change log
        # Parse structured JSON response and return score == "PASS"
        ...
{{< /code >}}

### Known Biases

Note that there are some known biases of LLM-as-a-Judge as studied in the [MT-Bench paper](https://arxiv.org/abs/2306.05685):

- **Position bias**: favors first/second response.
- **Verbosity bias**: favors longer responses.

### Building and Calibrating a Judge
The process of building and calibrating a Judge requires a **judge calibration dataset**: `(agent_output, human_quality_label)` pairs where a human expert has rated each output as pass or fail with reasoning.

From a dataset of ~50-100 examples, the split looks like: **3-8 carefully selected examples** as few-shot anchors in the judge prompt (both pass and fail, with critiques), **roughly half as a dev set** for iterating on the rubric, and **the rest held out as a test set** for final validation. The rubric text does the heavy lifting. Few-shot examples are calibration anchors, not training data.

Measure the judge with **True Positive Rate** (does the judge catch real failures?) and **True Negative Rate** (does it avoid flagging correct outputs?). Compare these against human labels on the held-out test set.

```
Humans (label small samples, high quality)
  → calibrate LLM Judge (validate TPR/TNR against human labels)
    → LLM Judge evaluates Agent (at scale)
      → Agent serves users
```

Why this works despite LLMs being imperfect: **judging is fundamentally easier than generating.** An LLM that hallucinates during open-ended generation can often reliably do scoped binary classification ("is this output correct given these criteria?"). The MT-Bench paper showed GPT-4 achieves >80% agreement with human preferences, comparable to human-human agreement.

Can you use the same model for both agent and judge? From what I gathered, usually yes. Self-preference bias exists but is often small enough not to matter. What matters more is empirical alignment with humans on your specific task.

**The alignment loop:** Run judge on dev set, compare to human labels. Where the judge disagrees, examine each disagreement: is the rubric ambiguous, or is this a genuinely hard edge case? Refine the rubric for ambiguities. Document edge cases rather than over-fitting. Validate on the test set. Re-calibrate periodically (every 1-2 months) with fresh production samples.


## From Prototype to Production

The maturity lifecycle gives a rough roadmap. Two prerequisites should be in place before even thinking about formal evals:

**Prerequisite: Observability.** Every source I read emphasized this: add tracing and logging from the very first prototype. Capture inputs, tool calls, intermediate reasoning, and outputs. You cannot evaluate what you cannot observe, and meaningful error analysis is impossible without traces. This is the foundation everything else builds on.

**Prerequisite: Deterministic checks as you build.** I found it helpful to think of deterministic graders as **unit tests for agents**. Just as I would not write a function without a test, I would not add agent capabilities without a corresponding check. These checks accumulate into the eval suite naturally. The point is not "adding evals later"; it is building them alongside the agent.

Whatever I am already testing manually during prototyping should go directly into the eval dataset. If I am copy-pasting a CSV into the agent and eyeballing the output, that CSV and my mental "looks correct" criteria are the first eval case. Formalizing them early creates a regression safety net as the agent evolves.

With that foundation in place, the maturity lifecycle for the cleaning agent might look like:

**Prototype:** Start with ~25 cases, seeded from whatever you have been testing by hand. Read every transcript manually. Deterministic graders only. Iterate rapidly on prompts and tool descriptions. Fix the most common failure modes first. Promote stable cases to regression evals as they consistently pass.

**MVP:** Add regression evals for things that work. Introduce the LLM judge for summary quality. Calibrate with a small dataset. Grow the eval dataset to 80-100 cases via synthetic generation. Start cost tracking. Run a second round of error analysis to find remaining edge cases. Add adversarial inputs.

**Production:** Watch for eval saturation (retire easy evals or increase difficulty). Add adversarial tasks. Production monitoring with sampled evaluation. Re-calibrate judges every 1-2 months. Measure with **pass@k** (at least one of k attempts correct) for capability. If reliability matters (and in production it usually does), track **pass^k** (all k attempts must succeed) instead. pass@k tells you what the agent *can* do; pass^k (a practitioner framing, not a formally standardized metric) tells you what it *will* do consistently.

For CI/CD: run fast deterministic evals on every commit (25 cases, sub-minute feedback), and comprehensive evals including LLM judges on PRs or nightly builds. In production, randomly sample traces (5%), run LLM judges on sampled traces to detect quality drift, and run the full error analysis workflow on fresh data every few weeks.

> **Observability vs. Evaluation:** These are complementary. Observability answers "what happened?" (traces, latency, errors). Evaluation answers "was it good?" (quality, correctness, safety). Observability provides the data; evaluation provides the judgment.

**A note on pairwise evaluation.** Everything above uses absolute evaluation (comparing agent output against a reference). For A/B testing model versions or prompt variations, **pairwise (relative) evaluation** is often more reliable: show two outputs side by side and ask "which is better?" Both humans and LLM judges find relative comparison easier than assigning absolute scores. Most practitioners I read about use absolute reference-based evaluation day-to-day and pairwise comparison only for A/B tests.

## Frameworks and Tooling

For reference, here is a comparison of frameworks relevant to building this:

**Eval Frameworks:**

| Framework | Approach | Best for |
|-----------|----------|----------|
| [pydantic-evals](https://ai.pydantic.dev/evals/) | Code-first Python, Dataset/Case/Evaluator, OpenTelemetry spans | Python-native agent eval with trajectory analysis |
| [OpenAI Evals Platform](https://platform.openai.com/docs/guides/evals) | Hosted infrastructure, trace grading | OpenAI ecosystem, rapid iteration |
| [Promptfoo](https://www.promptfoo.dev/) | YAML-config-driven, CI/CD native, red-team testing | CI/CD integration, security testing |
| [Braintrust](https://www.braintrust.dev/) | Experiment tracking, judge calibration | Experiment-driven development, A/B testing |
| [DeepEval](https://deepeval.com/) | Comprehensive eval framework, 50+ eval metrics, pytest-like unit-testing | All in one framework with CI/CD, integrated Observability and monitoring|

**Observability and Monitoring:**

| Framework | Approach | Best for |
|-----------|----------|----------|
| [Arize Phoenix](https://phoenix.arize.com/) | Production monitoring, online evaluations | OSS, self-hosted, observability + evaluation |
| [Pydantic Logfire](https://pydantic.dev/logfire) | OpenTelemetry-native, pydantic-ai integration | Python/pydantic-ai ecosystem |
| [Langfuse](https://langfuse.com/) | Open-source LLM observability, tracing | Self-hosted, multi-framework support |
| [LangSmith](https://smith.langchain.com/) | Chain debugging, annotation queues | LangChain ecosystem |


Obviously, there are existing observability and monitoring tools like datadog or the whole grafana stack. I saw datadog has a new LLM Observability feature set. If you are evaluating any such tools/platform, look if it supports the new [GenAI semantic conventions](https://opentelemetry.io/docs/specs/semconv/gen-ai/)

## Personal Notes

- There are still a few unanswered questions, confusions. For example, how do you run deterministic tests cheaply, specially in CI environment. My current understanding makes me feel reusing responses across tests, prompt caching should mitigate this. But this requires further exploration.

- Designing and building the rubrics and/or LLM-as-a-Judge seems the hardest part.

- The error analysis development loop makes sense on paper but it seems very involved and demanding to be effective.

- I feel structured output ***should*** help with overall evaluation be it deterministic tests and/or model graded ones. But I need to validate this on a concrete case.

## References

### Primary Sources

- [Anthropic: Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) - Flywheel concept, grader hierarchy, error analysis methodology
- [Anthropic: Claude Testing & Evaluation Docs](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) - Official eval framework, LLM-based grading terminology
- [Hamel Husain: Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) - Practitioner's manifesto; "look at your data" philosophy
- [Hamel Husain: LLM-as-a-Judge Complete Guide](https://hamel.dev/blog/posts/llm-judge/) - Step-by-step judge building, TPR/TNR measurement
- [Hamel Husain: LLM Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) - Same model for judge and agent? Likert vs binary
- [Hamel Husain: A Field Guide to AI Agents](https://hamel.dev/blog/posts/field-guide/) - Error Analysis as the central development loop
- [Shreya Shankar & Hamel Husain: Evals for AI Engineers](https://learning.oreilly.com/library/view/evals-for-ai/9798341660717/) - Book (early release, O'Reilly), comprehensive error analysis methodology
- [Lenny's Newsletter: Evals, Error Analysis, and Better Prompts](https://www.lennysnewsletter.com/p/evals-error-analysis-and-better-prompts) - Interview with Hamel on the error analysis cycle

### Academic Papers

- [Zheng et al.: Judging LLM-as-a-Judge with MT-Bench and Chatbot Arena (NeurIPS 2023)](https://arxiv.org/abs/2306.05685) - Foundational LLM-as-Judge paper, GPT-4 >80% human agreement

### Supplementary

- [Pragmatic Engineer: Evals](https://newsletter.pragmaticengineer.com/p/evals)
- [Evidently AI: LLM-as-a-Judge Guide](https://www.evidentlyai.com/llm-guide/llm-as-a-judge)
- [HoneyHive: Avoiding Common Pitfalls in LLM Evaluation](https://www.honeyhive.ai/post/avoiding-common-pitfalls-in-llm-evaluation)
- [Braintrust: Agent Evaluation Best Practices](https://www.braintrust.dev/docs/best-practices/agents)
- [Adaline Labs: AI Observability and Evaluations](https://labs.adaline.ai/p/ai-observability-and-evaluations)
- [O'Reilly: Evaluating Large Language Models (video)](https://learning.oreilly.com/videos/evaluating-large-language/9780135451922/)
