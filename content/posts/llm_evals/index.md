---
title: "A Synthesis of LLM Evaluation"
date: 2026-03-15
draft: false
slug: "llm-agent-evals"
tags: ["llm", "evals", "ai-agents", "testing", "python"]
categories: ["Programming", "Evals", "LLM"]
description: "I spent a few weeks going deep on LLM evaluation practices. This is my synthesis: the three-layer eval stack, LLM-as-a-Judge, error analysis as a development methodology, and a design exercise applying it all to a data cleaning agent."
toc: true
---

I have been building a few agent prototypes and hit a wall that I think is common: beyond a certain point, reliability just falls apart. LLMs fail silently. Traditional software throws an exception when something goes wrong; an LLM produces a plausible-sounding but wrong answer, and nobody notices until real damage is done. With newer models, frameworks, and techniques shipping every week, it is hard to know whether a change is actually better or just different. I needed a systematic way to measure quality. That is what evals are.

I spent a few weeks going deep on evaluation practices for AI agents. I read everything I could find: [Anthropic's engineering blog](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents), [Hamel Husain's practitioner-focused guides](https://hamel.dev/blog/posts/evals/), the [Evals for AI Engineers book](https://learning.oreilly.com/library/view/evals-for-ai/9798341660717/) by Shreya Shankar and Hamel Husain, the [MT-Bench paper](https://arxiv.org/abs/2306.05685), and several eval framework docs. This post is my synthesis of what actually matters, what the common traps are, and how to think about evaluation systematically. To keep things concrete, I work through a design exercise applying these ideas to a hypothetical data cleaning agent. (Terminology varies across frameworks; see the [quick reference](#terminology-quick-reference) at the end if you run into unfamiliar names.)

**TL;DR:**

- **Observability first.** You cannot evaluate what you cannot observe. Add tracing from day one.
- **Deterministic checks are unit tests for agents.** Write them as you build, not after.
- **Three-layer eval stack:** what you evaluate (the agent), how you grade (deterministic checks, then LLM-as-a-Judge, then humans), and what grounds it all (datasets).
- **Error analysis is the development methodology.** Not testing. The agent, judge, and datasets co-evolve through the same loop.
- **Start with 20-50 cases** focused on known failures. Use binary pass/fail over Likert scales. Never stop reading traces.

## Why Evals Matter

Without evals, every change to a prompt, model, or retrieval pipeline could improve one thing and quietly break three others. I was flying blind, relying on vague intuitions instead of concrete measurements.

Evals create a **flywheel of improvement**:

1. **Analyze** - examine data to find where the system fails
2. **Measure** - build targeted evaluators that quantify those failures
3. **Improve** - experiment with changes (prompts, models, retrieval strategies)
4. **Automate** - turn confirmed fixes into regression tests that prevent backsliding

Each rotation makes your system more reliable. The eval loop *is* the development loop.

## Design Exercise: Evaluating a Data Cleaning Agent

To make this synthesis concrete, I will work through how I would design an eval suite for a specific agent, applying the principles from the sources above. **None of this has been run end-to-end. It is a design exercise, not a case study.** The specific numbers are illustrative; the architecture is what matters.

The agent: accepts a messy CSV or Excel file plus a natural-language cleaning spec (e.g., "standardize date columns to ISO-8601, remove duplicates on `order_id`, fill missing `country` from `city` lookup"). It outputs a cleaned file plus a structured change log.

| Property | Value |
|----------|-------|
| **Tools** | `read_file`, `write_file`, `pandas_transform`, `column_stats`, `preview_rows` |
| **Output** | Cleaned CSV/Excel + JSON change log |
| **Grading balance** | ~80% deterministic code graders, ~20% LLM judge |
| **Framework** | pydantic-evals |

## The Three-Layer Evaluation Stack

There are three distinct layers in any evaluation system. Keeping them separate is critical because conflating them is where most of the confusion in this space comes from. Use the same dataset to measure both "is my agent good?" and "is my judge trustworthy?" and it becomes impossible to tell which one is broken when scores drop.

### Layer 1: What You're Evaluating (The Agent)

The agent is the system under test. The sources I read consistently break agent behavior into several dimensions: **output quality** (is the final answer correct?), **tool use** (right tools, right parameters, no hallucinated calls?), **trajectory** (sensible path to the answer?), **interaction** (multi-turn coherence, error recovery), and **cost** (tokens, latency, dollars).

There are also cross-cutting behavioral dimensions worth tracking: planning, self-reflection, and memory across turns.

**One important nuance on trajectory evaluation.** There is a natural instinct to check that agents followed very specific steps. Anthropic warns against this: it is too rigid. The better approach (and the consensus across everything I read) is to grade what the agent *produced* (postconditions), not the exact *path* it took. Reserve trajectory checks for safety invariants (forbidden tools) and critical ordering constraints (e.g., auth before write). For everything else, trajectory is informational.

For the data cleaning agent, the dimension mapping looks like this:

| Dimension | What it means here | Grading approach |
|-----------|--------------------|------------------|
| **Output quality** | Is the cleaned file correct? All specified transforms applied? | Deterministic (row counts, schema checks, cell-level diffs) |
| **Tool use** | Did it call `pandas_transform` with valid operations? No hallucinated column names? | Deterministic (tool call log validation) |
| **Trajectory** | Did it preview data before transforming? Avoid unnecessary passes? | Informational (step count, checked via code) |
| **Cost** | Tokens, latency, number of tool calls | Deterministic (budget thresholds) |

Evals also serve two different purposes: **capability evals** ("does this agent do X well?", with scores that start low and climb) and **regression evals** ("does it still do X as well as before?", which should stay at 100%). When a capability eval consistently hits near-perfect scores, promote it to a regression eval or increase difficulty. For the cleaning agent, handling exotic encodings would be a capability eval; basic dedup would be a regression eval.

### Layer 2: How You're Grading (The Grading Pipeline)

Three types of graders, in priority order. The consistent advice I found is to use the cheapest reliable option first:

1. **Deterministic graders** (code-based) - use wherever possible. String matching, schema validation, tool call verification, pass/fail tests. Cheap, fast, reproducible, CI-friendly. **If you can write a code check for it, do not use an LLM judge.**
2. **LLM-as-Judge** (model-graded) - for subjective dimensions only. Coherence, helpfulness, tone, reasoning quality. More on this [below](#llm-as-a-judge).
3. **Human graders** - for calibration, edge cases, and validating the other two. Expensive but essential as the root of trust.

For the cleaning agent, about 80% of the grading is deterministic. Here are the core graders:

> **Note:** The pydantic-evals API is simplified here for illustration. The exact span attribute keys (e.g., `gen_ai.tool.name`) depend on what your agent framework records via OpenTelemetry. Check the [pydantic-evals docs](https://ai.pydantic.dev/evals/) for the current API.

{{< code lang="python" filename="evaluators.py" >}}
from dataclasses import dataclass
from pydantic_evals.evaluators import Evaluator, EvaluatorContext

@dataclass
class RowCountEvaluator(Evaluator[dict, dict, None]):
    """Check that the output file has the expected number of rows."""
    def evaluate(self, ctx: EvaluatorContext[dict, dict, None]) -> bool:
        expected = ctx.expected_output
        actual = ctx.output

        if "row_count" in expected:
            return actual["row_count"] == expected["row_count"]
        if "row_count_range" in expected:
            lo, hi = expected["row_count_range"]
            return lo <= actual["row_count"] <= hi
        return True

@dataclass
class SchemaEvaluator(Evaluator[dict, dict, None]):
    """Verify output columns match expected schema."""
    def evaluate(self, ctx: EvaluatorContext[dict, dict, None]) -> bool:
        if "columns" not in ctx.expected_output:
            return True
        return set(ctx.expected_output["columns"]) == set(ctx.output["columns"])

@dataclass
class ToolCallValidator(Evaluator[dict, dict, None]):
    """Verify tool calls are valid — no hallucinated column names."""
    def evaluate(self, ctx: EvaluatorContext[dict, dict, None]) -> bool:
        allowed_tools = {"read_file", "write_file", "pandas_transform",
                         "column_stats", "preview_rows"}
        # Access tool calls via span tree node attributes
        for node in ctx.span_tree.find(lambda n: "gen_ai.tool.name" in n.attributes):
            tool_name = node.attributes.get("gen_ai.tool.name", "")
            if tool_name and tool_name not in allowed_tools:
                return False
        return True

@dataclass
class WarningEvaluator(Evaluator[dict, dict, None]):
    """For negative cases: verify agent warns about issues."""
    def evaluate(self, ctx: EvaluatorContext[dict, dict, None]) -> bool:
        if not ctx.expected_output.get("should_warn"):
            return True
        warning_text = ctx.expected_output["warning_contains"]
        return warning_text.lower() in ctx.output.get("warning", "").lower()

@dataclass
class CostBudgetEvaluator(Evaluator[dict, dict, None]):
    """Verify the agent stays within tool call budget."""
    def evaluate(self, ctx: EvaluatorContext[dict, dict, None]) -> bool:
        tool_spans = list(ctx.span_tree.find(
            lambda n: "gen_ai.tool.name" in n.attributes
        ))
        return len(tool_spans) <= 30
{{< /code >}}

Additional graders would cover spot checks on specific cell values, null counts, and change log verification. Eight deterministic graders total.

The remaining ~20% needs an LLM judge: specifically, evaluating whether the human-readable summary in the change log is accurate, complete, and clear. That is the one dimension that resists reduction to code. More on building and calibrating this judge in the [LLM-as-a-Judge section](#llm-as-a-judge).

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

### Layer 3: What Grounds Everything (Datasets)

Two distinct datasets serve two distinct purposes:

| Dataset | Structure | Purpose |
|---------|-----------|---------|
| **Agent eval dataset** | `(input, expected_output)` pairs | Measures agent quality |
| **Judge calibration dataset** | `(agent_output, human_quality_label)` pairs | Measures judge accuracy |

These are **different datasets**. The agent eval dataset answers "is my agent good?" The judge calibration dataset answers "is my judge trustworthy?" Conflating them was one of the most common sources of confusion I encountered in the literature.

The `expected_output` is not limited to exact string matches. It can be structured data for multi-axis scoring, a natural-language reference for an LLM judge, or a verification function.

For the cleaning agent, I would start with ~25 hand-curated `(input, expected_output)` pairs. Each input is a messy file plus a cleaning instruction. Each expected output is the cleaned file content plus the expected change log:

```yaml
# Case 1: Basic dedup + date normalization
- name: "dedup_and_dates"
  inputs:
    file: "fixtures/orders_messy_001.csv"
    instruction: >
      Remove duplicate rows based on order_id (keep first occurrence).
      Standardize the order_date column to ISO-8601 format (YYYY-MM-DD).
  expected_output:
    row_count_range: [140, 150]
    columns: ["order_id", "customer", "order_date", "amount"]
    change_log:
      rows_removed: 8
      cells_modified: 23
    spot_checks:
      - row: 0
        order_date: "2024-01-15"
    summary_reference: >
      The agent should mention removing duplicate orders with a specific
      count and converting date cells from mixed formats (MM/DD/YYYY,
      DD-Mon-YY) to ISO-8601.
  tags: ["dedup", "date-normalization", "basic"]

# Case 2: Null filling with lookup
- name: "null_fill_country_from_city"
  inputs:
    file: "fixtures/customers_missing_country.csv"
    instruction: >
      Fill missing values in the 'country' column by looking up the city.
      If the city is not recognizable, set country to 'UNKNOWN'.
  expected_output:
    row_count: 500
    null_counts:
      country: 0
    change_log:
      cells_modified: 47
      cells_set_unknown: 3
    spot_checks:
      - row: 12
        city: "Mumbai"
        country: "India"
      - row: 388
        city: "Xyzzyville"
        country: "UNKNOWN"
  tags: ["null-fill", "lookup", "medium"]

# Case 3: Negative case — agent should WARN, not crash
- name: "missing_required_column"
  inputs:
    file: "fixtures/transactions_no_id.csv"
    instruction: >
      Deduplicate on transaction_id and normalize amounts to 2 decimal places.
  expected_output:
    should_warn: true
    warning_contains: "transaction_id"
    change_log:
      error: "Column 'transaction_id' not found in input file"
  tags: ["negative-case", "schema-validation", "warning"]
```

**A few design principles I took away:** Include both positive and negative cases. Include a reference solution that passes all graders to verify the pipeline itself (a 0% pass rate usually means the graders are broken, not the agent). Tag cases for filtering so you can run only "basic" cases on every commit and the full suite on PRs.

## LLM-as-a-Judge

This is the part of the evaluation stack I found most interesting and most nuanced, so I want to go deeper here.

The consensus across practitioners is clear: use LLM judges **only for qualities that resist reduction to code checks**. They should not be used for:

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

For the cleaning agent, the summary quality judge looks like this:

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

From the [MT-Bench paper](https://arxiv.org/abs/2306.05685):

| Bias | Mitigation |
|------|------------|
| **Position bias** (favors first/second response) | Call twice with positions swapped |
| **Verbosity bias** (favors longer responses) | Include length-neutrality in rubric |
| **Self-enhancement** (favors same model's output; effect size is often small) | Use a different model family as judge |
| **Limited reasoning** (validates wrong math/logic) | Chain-of-thought, reference-guided grading mitigates |

### Building and Calibrating a Judge

This is where it gets concrete. The process requires a **judge calibration dataset**: `(agent_output, human_quality_label)` pairs where a human expert has rated each output as pass or fail with reasoning.

From a dataset of ~50-100 examples, the split looks like: **3-8 carefully selected examples** as few-shot anchors in the judge prompt (both pass and fail, with critiques), **roughly half as a dev set** for iterating on the rubric, and **the rest held out as a test set** for final validation. The rubric text does the heavy lifting. Few-shot examples are calibration anchors, not training data.

Measure the judge with **True Positive Rate** (does the judge catch real failures?) and **True Negative Rate** (does it avoid flagging correct outputs?). Compare these against human labels on the held-out test set.

This is what breaks the circular dependency of "using LLMs to evaluate LLMs," and it was one of the things I found most clarifying. There is no need for another LLM to evaluate the judge. Humans are the root of trust, but only at a manageable scale (dozens to low hundreds of examples). The judge then scales that human judgment to thousands of evaluations.

```
Humans (label small samples, high quality)
  → calibrate LLM Judge (validate TPR/TNR against human labels)
    → LLM Judge evaluates Agent (at scale)
      → Agent serves users
```

Why this works despite LLMs being imperfect: **judging is fundamentally easier than generating.** An LLM that hallucinates during open-ended generation can often reliably do scoped binary classification ("is this output correct given these criteria?"). The MT-Bench paper showed GPT-4 achieves >80% agreement with human preferences, comparable to human-human agreement.

Can you use the same model for both agent and judge? From what I gathered, usually yes. Self-preference bias exists but is often small enough not to matter. What matters more is empirical alignment with humans on your specific task.

To illustrate the shape of a calibration dataset, here is what entries for the cleaning agent's summary judge might look like. The key: clear PASS and FAIL examples with human reasoning that explains the judgment:

```yaml
# Calibration entry: PASS — summary matches change log with specific counts
- agent_output:
    summary: "Removed N duplicate orders and converted M date cells to ISO format."
    change_log: {rows_removed: N, cells_modified: M}
  human_label: PASS
  human_reasoning: "Summary accurately reflects change log. Clear and concise."

# Calibration entry: FAIL — too vague, no counts
- agent_output:
    summary: "Cleaned the data by removing duplicates and fixing dates."
    change_log: {rows_removed: N, cells_modified: M}
  human_label: FAIL
  human_reasoning: "Too vague — no specific counts. 'Fixing dates' doesn't specify format."

# Calibration entry: FAIL — factual mismatch with change log
- agent_output:
    summary: "Removed X duplicate orders and normalized all dates."
    change_log: {rows_removed: Y, cells_modified: M}
  human_label: FAIL
  human_reasoning: "Claims X duplicates but change log says Y. Factual inaccuracy."
```

The iteration process would look like this: run the judge on the dev set, measure TPR and TNR against human labels, refine the rubric where the judge disagrees with humans. From what I read, each round of refinement tends to improve one metric at the cost of the other. Adding a specificity criterion (vague counts = FAIL) might improve TPR but slightly reduce TNR. The goal is a rubric that is stable across both metrics, not one that maximizes either.

**The alignment loop:** Run judge on dev set, compare to human labels. Where the judge disagrees, examine each disagreement: is the rubric ambiguous, or is this a genuinely hard edge case? Refine the rubric for ambiguities. Document edge cases rather than over-fitting. Validate on the test set. Re-calibrate periodically (every 1-2 months) with fresh production samples.

## Error Analysis: The Core Development Loop

This was the biggest reframing for me. Error analysis is not a dataset-building technique. It is the **central development methodology** for AI agents. Everything else (datasets, judges, prompts) grows out of this loop.

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

**Annotate:** A human SME reads each trace carefully, writing brief notes about anything surprising, incorrect, or wrong-feeling. **No LLMs in this step.** The goal is to find patterns, not just individual failures.

**Cluster:** Group similar annotations into coherent failure modes (e.g., "hallucinated tool calls", "lost context after 5 turns", "wrong tool for date queries"). LLMs can help with initial clustering, but humans must validate. Typically 2-3 rounds to stabilize the taxonomy.

**Act:** For each failure mode, triage: **is this an agent problem, a judge problem, or a dataset gap?**

For the cleaning agent, a hypothetical failure taxonomy after ~100 traces might look like this (illustrative figures):

| Cluster | Count | Root Cause | Triage |
|---------|-------|------------|--------|
| **Column hallucination** | 18 | Agent does not check `column_stats` before transforming | Agent problem |
| **Incomplete multi-step** | 12 | Agent loses track after 3+ operations | Agent problem |
| **Silent type error** | 9 | `pandas_transform` returns success without type validation | Agent + Judge |
| **Overcleaning** | 7 | Ambiguous instruction interpretation | Dataset gap |
| **Summary drift** | 5 | Summary generated mid-process, not updated after | Judge problem |

Actions per cluster:

- **Column hallucination** (agent): Add hard constraint in system prompt: "ALWAYS call `column_stats` before any `pandas_transform`." Add a trajectory grader enforcing this ordering.
- **Incomplete multi-step** (agent): Add planning step: "For multi-step instructions, first list all operations, then execute in order."
- **Silent type error** (agent + judge): Add post-transform type validation and a `ColumnTypeEvaluator` grader.
- **Overcleaning** (dataset): Add 3 new negative cases where blank optional fields should NOT trigger row deletion.
- **Summary drift** (judge): Refine the LLM judge rubric to explicitly cross-check summary claims against the structured change log.

Every failure discovered also feeds back into the agent eval dataset as a regression test. Error analysis feeds **all three** components simultaneously. It is not circular; it is a spiral where each pass improves the agent, the judge, and the datasets together.

**When multiple people are annotating:** Draft working definitions of failure/success with pass/fail examples. Have each annotator label a common set of 20-50 traces independently, then measure inter-annotator agreement (Cohen's kappa). Low agreement signals ambiguous rubrics. Run alignment sessions to discuss disagreements and clarify. One strong domain expert matters more than a committee. Find the principal domain expert whose judgment drives decisions.

## From Prototype to Production

The maturity lifecycle gives a rough roadmap. Two prerequisites should be in place before even thinking about formal evals:

**Prerequisite: Observability.** Every source I read emphasized this: add tracing and logging from the very first prototype. Capture inputs, tool calls, intermediate reasoning, and outputs. You cannot evaluate what you cannot observe, and meaningful error analysis is impossible without traces. This is the foundation everything else builds on. For the cleaning agent, that means logging every `pandas_transform` call, its parameters, and the result, not just the final output.

**Prerequisite: Deterministic checks as you build.** I found it helpful to think of deterministic graders as **unit tests for agents**. Just as I would not write a function without a test, I would not add agent capabilities without a corresponding check. When I add date normalization to the cleaning agent, I would write a `RowCountEvaluator` and a spot-check grader at the same time. These checks accumulate into the eval suite naturally. The point is not "adding evals later"; it is building them alongside the agent.

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
| [Inspect AI](https://inspect.ai-safety-institute.org.uk/) | Task = Dataset + Solver + Scorer, sandbox environments | Safety evaluation, standardized benchmarks |
| [OpenAI Evals Platform](https://platform.openai.com/docs/guides/evals) | Hosted infrastructure, trace grading | OpenAI ecosystem, rapid iteration |
| [Promptfoo](https://www.promptfoo.dev/) | YAML-config-driven, CI/CD native, red-team testing | CI/CD integration, security testing |
| [Braintrust](https://www.braintrust.dev/) | Experiment tracking, judge calibration | Experiment-driven development, A/B testing |

**Observability and Monitoring:**

| Framework | Approach | Best for |
|-----------|----------|----------|
| [Arize Phoenix](https://phoenix.arize.com/) | Production monitoring, online evaluations | OSS, self-hosted, observability + evaluation |
| [Pydantic Logfire](https://pydantic.dev/logfire) | OpenTelemetry-native, pydantic-ai integration | Python/pydantic-ai ecosystem |
| [Langfuse](https://langfuse.com/) | Open-source LLM observability, tracing | Self-hosted, multi-framework support |
| [LangSmith](https://smith.langchain.com/) | Chain debugging, annotation queues | LangChain ecosystem |

From what I gathered, pydantic-evals and Promptfoo are good starting points for eval, depending on whether you prefer code-first or config-first. For observability, Langfuse and Arize stand out as open-source options with broad framework support.

## Key Takeaways

These are the principles that came up most consistently across the sources I read. They are not rules I have battle-tested myself (yet), but the reasoning behind each one is compelling:

1. **Observability, deterministic checks, then evals.** In that order. You cannot evaluate what you cannot observe, and deterministic graders (your "unit tests for agents") should be written alongside the agent from day one.

2. **Start early.** 20-50 failure-focused tasks is enough. Whatever you are already testing by hand is your first dataset.

3. **Grade outputs first, then trajectories.** There are often multiple valid paths to the right answer.

4. **Read transcripts regularly.** Scores compress away the details. You will find problems that no automated grader catches.

5. **Binary pass/fail over Likert scales.** 1-5 ratings are often a sign of a bad eval process.

6. **Build evals for errors you discover, not errors you imagine.**

7. **One domain expert matters more than a committee.**

8. **You can never stop looking at data.** There is no eval setup that lets you stop reviewing traces.

9. **A 0% pass rate means your eval is broken**, not that your agent is incapable.

## Personal Notes

- Before this deep dive, I thought evals were a "testing phase" you do after building the agent. That framing is backwards. Error analysis and evals *are* the development methodology. The agent, the judge, and the datasets all co-evolve through the same loop. This reframing was the single most valuable thing I took away.

- The insight that judging is fundamentally easier than generating made the whole "using LLMs to evaluate LLMs" approach feel less circular than it sounds. A model that hallucinates freely during generation can still reliably answer "does this output match these criteria?" That distinction makes the whole approach viable.

- Hamel Husain's point about the judge being a "hack" resonated with me. The process of building the judge (examining outputs, writing rubrics, calibrating against human labels) forces you to deeply understand your data. The actual automated judge is almost a side effect. I think this is the most important insight in the whole space.

- The error analysis triage step (agent problem vs. judge problem vs. dataset gap) seems like where the real judgment happens. Easy to describe in theory. I suspect it requires significant experience to do well in practice.

- I went into this research because my own agent prototypes hit a reliability wall and I had no systematic way to tell whether changes were helping. I was eyeballing outputs and going on vibes. Everything I read confirmed that this is the default state for most people building with LLMs, and that the path forward is not more clever prompting but better measurement. I have not yet applied this full framework to my own agents, but the mental model has already changed how I think about building them.


## Terminology Quick Reference

Different frameworks use different names for the same concepts. This tripped me up during research:

| Concept | Anthropic | pydantic-evals | OpenAI |
|---------|-----------|----------------|--------|
| Single test scenario | Task | `Case` | Test case |
| Collection of tasks | Dataset / Eval Suite | `Dataset` | Eval |
| One execution attempt | Trial | single run of `evaluate` | Run |
| Scoring logic | Grader | `Evaluator` | Grader |
| Execution record | Transcript / Trace | `span_tree` | Trace |
| Known correct answer | Reference Solution | `expected_output` | Expected |
| Run infrastructure | Eval Harness | `dataset.evaluate_sync()` | Evals Platform |

**Key differences:** Anthropic emphasizes running the same task multiple times (pass@k) and trial isolation. Pydantic-evals runs each case once by default and provides `span_tree` via OpenTelemetry for trajectory access. Isolation depends on your implementation in most frameworks (Inspect AI being the exception with built-in sandboxes).

## References

### Primary Sources

- [Anthropic: Demystifying Evals for AI Agents](https://www.anthropic.com/engineering/demystifying-evals-for-ai-agents) - Flywheel concept, grader hierarchy, error analysis methodology
- [Anthropic: Claude Testing & Evaluation Docs](https://platform.claude.com/docs/en/test-and-evaluate/develop-tests) - Official eval framework, LLM-based grading terminology
- [Hamel Husain: Your AI Product Needs Evals](https://hamel.dev/blog/posts/evals/) - Practitioner's manifesto; "look at your data" philosophy
- [Hamel Husain: LLM-as-a-Judge Complete Guide](https://hamel.dev/blog/posts/llm-judge/) - Step-by-step judge building, TPR/TNR measurement
- [Hamel Husain: LLM Evals FAQ](https://hamel.dev/blog/posts/evals-faq/) - Same model for judge and agent? Likert vs binary
- [Hamel Husain: A Field Guide to AI Agents](https://hamel.dev/blog/posts/field-guide/) - Error analysis as the central development loop
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
