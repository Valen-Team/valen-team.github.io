---
title: "User Simulator and dynamic conversation"
---

# User Simulator and dynamic conversation

The User Simulator is a model that runs in a separate Harness and acts as the user. After the Task Agent completes an instruction, the User Simulator reads the conversation so far and decides whether to make another request or end the task. The conversation is generated one turn at a time.

Use this mode for tasks that introduce requirements gradually or revise them in response to the Agent, such as drafting recruitment ads, requirements interviews, customer support, tutoring, and interactive code review.

## 1. Difference from predefined multi-turn

| Mode | Source of user messages | Typical use |
| --- | --- | --- |
| `messages` | Written in the Task file in advance | Reproducible fixed flows, regression tests |
| `user_simulator` | Generated dynamically from the Agent's current reply | Follow-up requirements, probing, negotiation, and adaptive tasks |

In predefined multi-turn mode, the next message is fixed regardless of the Agent's reply. The User Simulator can check for omissions, correct the direction, or finish early when the goal has been met.

The two modes cannot appear in the same task. Single-turn and predefined multi-turn syntax is described in the [Task format reference](/roller/tasks/task-format/#3-conversation-modes).

## 2. A complete Task

```json
{
  "schema_version": "roller.task/v1",
  "id": "hr_recruitment_ad",
  "harness": "codex",
  "model": "my-openai-proxy/task-agent-model",
  "user_simulator": {
    "harness": "openclaw",
    "model": "my-openai-proxy/simulator-model",
    "max_turns": 6,
    "thinking": "high",
    "instruction": "你是一名正在招聘后端工程师的 HR。通过多轮交流让任务 Agent 完成一份中文招聘广告。先说明基本需求，再根据当前草稿逐步补充职责、技术要求、薪资、远程政策和申请方式；不要一次给出全部信息。最终版本必须保存到 outputs/recruitment-ad.md，确认内容完整且文件已经保存后结束。"
  },
  "files": {
    "output_dir": "outputs"
  }
}
```

| Field | Required | Default | Description |
| --- | --- | --- | --- |
| `instruction` | yes | none | Fixed identity, goal, interaction strategy, and completion criteria |
| `harness` | no | `openclaw` | Harness used by the Simulator: `openclaw`, `codex`, `claude-code`, `hermes`, `opencode`, `deepseek`, or `pi` |
| `model` | no | Task Agent model | Model ref used by the Simulator |
| `max_turns` | no | `6` | Maximum number of instructions sent to the Task Agent, range `1–100` |
| `thinking` | no | CLI default | Overrides the Simulator only; uses the same logical levels and validation as [`--thinking`](/roller/harnesses/openclaw-configuration/#6-thinking-configuration) |

The CLI option `--model` overrides only the Task Agent model; `user_simulator.model` is still taken from the task configuration. When the Simulator model is omitted, the Simulator uses the Task Agent model in effect for this run.

## 3. Conversation Manager

A dynamic rollout has three participants:

| Participant | Responsibility |
| --- | --- |
| Conversation Manager | Maintains context, forwards messages, and enforces turn and timeout rules |
| Task Agent | Executes user instructions, calls tools, reads inputs, and writes results |
| User Simulator | Generates the next user instruction from the fixed instruction and the full conversation |

Execution order:

1. The Manager starts the Task Agent session and the User Simulator session.
2. The Manager sends the fixed instruction, an empty conversation, and turn state to the Simulator.
3. The Simulator produces the first user message, and the Manager forwards it to the Task Agent.
4. After the Agent finishes the current turn, the Manager appends the user/assistant messages to the transcript.
5. The Manager sends the fixed instruction and the updated full transcript to the Simulator again.
6. The alternating process repeats until the Simulator finishes, the turn limit is reached, an error occurs, or the overall timeout expires.

Both sessions persist for the entire rollout and are not restarted in each turn. The Task Agent owns the task inputs, Context, and `output_dir`; the Simulator uses an isolated workspace and obtains task progress only from the conversation that the Manager provides. Codex and Claude Code also support this interaction interface; each uses its own native resume/continue session.

## 4. Simulator decision protocol

On every call, the Manager provides:

- the task's fixed `instruction`;
- `rounds_completed` and `max_turns`;
- the full user/assistant transcript from the first turn.

The Simulator must return exactly one of the following two JSON objects.

Continue the conversation:

```json
{"action":"message","content":"请在岗位要求中补充 Python 与 PostgreSQL。"}
```

Finish the conversation:

```json
{"action":"finish","reason":"招聘广告内容完整，且已确认写入目标文件。"}
```

Roller reads the decision with a JSON parser and does not infer turns or end markers from Markdown headings, separators, or natural-language keywords. A response that contains a Markdown code fence, extra explanation, an unknown action, or empty content fails the current attempt; with `--retries`, the entire rollout can be rerun.

The Simulator must send at least one instruction to the Task Agent before it can finish.

## 5. Writing the instruction

The instruction guides the Simulator in every turn. It specifies how the Simulator generates user messages and is not sent as the first message. An instruction should include the following:

1. **Identity**: who the Simulator is and what information it holds.
2. **Goal**: what the Agent must ultimately complete.
3. **Disclosure strategy**: whether information is given all at once or added gradually from the current result.
4. **Checks**: which omissions, errors, or deliverable states to inspect each turn.
5. **Finish condition**: when to return `finish`, and whether the target file must be confirmed to exist.

In the HR example, a reasonable interaction may proceed as follows:

| Stage | Simulator behavior |
| --- | --- |
| Start | Give basic role and candidate requirements |
| Revise | Review the draft and add responsibilities and tech stack |
| Refine | Continue with salary, working style, and application channel |
| Accept | Check completeness and require a write to `outputs/recruitment-ad.md` |
| Finish | Return `finish` after the Agent clearly completes delivery |

Do not combine “reveal requirements gradually” with a first-turn script that already contains every detail in the same instruction; otherwise, the Simulator may give all requirements in its first message. Do not specify only a vague identity without a finish condition; otherwise, the Simulator may continue asking until it reaches `max_turns`.

The repository contains a runnable version of this example: [`examples/tasks/user-simulator.jsonl`](https://github.com/Valen-Team/Roller/blob/main/examples/tasks/user-simulator.jsonl).

## 6. Termination and failure

`conversation.json` records the termination type in `termination.reason`:

| Reason | Status | Meaning |
| --- | --- | --- |
| `simulator_finished` | `ok` | The Simulator confirmed the goal is complete |
| `max_turns` | `ok` | The allowed Agent turns have been completed, but the Simulator still requested to continue |
| `timeout` | `timeout` | Combined execution time of both Harnesses exceeded `--timeout` |
| `agent_error` | `error` | The Task Agent session failed to finalize |
| `simulator_error` | `error` | The Simulator session failed to finalize |
| `simulator_trace_error` | `error` | The Simulator raw trace could not be archived or converted |
| `error` | `error` | Decision JSON, container, or another scheduling stage failed |

After the `max_turns`-th Agent turn, the Manager requests one more Simulator decision so that the Simulator can confirm completion. If the Simulator returns `message` at that point, the message is not sent to the Agent; it is recorded in `termination.pending_instruction` and the run ends normally with `max_turns`.

`--timeout` is the total limit for the entire dynamic rollout, including both container starts, every Simulator call, every Task Agent turn, and trace finalization. Long conversations should be allowed more time than an ordinary single-turn task.

## 7. Models, parallelism, and cost

The Task Agent and the Simulator can each use their own Harness and model. For example, Codex can execute the task while OpenClaw or Claude Code acts as the user; both participants can also use the same Harness with different models. OpenClaw model refs are still read from `--model-config`; Codex/Claude Code/Hermes/OpenCode/DeepSeek/Pi use their own API parameters.

```bash
roller collect \
  --tasks examples/tasks/user-simulator.jsonl \
  --model-config examples/config/openclaw/models.json \
  --docker-image your-openclaw-image:tag \
  --parallel 2 \
  --timeout 900 \
  --output runs \
  --run-name user_simulator_hr
```

`--parallel N` still sets the number of concurrent rollouts to N. Each dynamic rollout occupies two containers at the same time and produces two sets of model calls and two traces. If OpenClaw reports a port conflict, see the common issues in the [OpenClaw guide](/roller/harnesses/openclaw-configuration/).

## 8. Saving and using traces

A dynamic sample also saves the conversation visible to both participants and adds a Simulator subdirectory:

```text
samples/<task-agent-model>/<index>_<task>/
├── trace.jsonl                    # Task Agent raw trace
├── trace_ACTF.json                # Task Agent ACTF_v1.0
├── trace_SFT.json                 # Task Agent SFT record
├── conversation.json              # alternating dialogue and termination information
├── info.json                      # total usage and per-participant details
├── user_simulator/
│   ├── trace.jsonl                # Simulator raw trace
│   ├── trace_ACTF.json            # Simulator ACTF_v1.0
│   ├── trace_SFT.json             # Simulator SFT record
│   └── info.json                  # Simulator metadata
└── results/                       # optional; the Task Agent's output_dir
```

Intended use of each file:

- Train the Task Agent: use the root `trace_SFT.json` or the run-level `sft.jsonl`; for analysis use `trace.jsonl` or `trace_ACTF.json`.
- Study simulated-user strategy: use the traces under `user_simulator/`.
- Analyze only the conversation both sides can see: use `conversation.json`.
- Measure cost: `usage` in the root `info.json` is the combined total; `conversation.participants` in the root `info.json` stores the usage and trace locations of each participant.
- Check task delivery: use `results/`, which only collects Task Agent output.

`conversation.json` does not copy hidden reasoning, tool calls, or tool results; these events remain in the raw/ACTF/SFT traces of each participant. Output conditions are described in the [Trajectory output file guide](/roller/traces/trajectory-outputs/); sample fields and result-safety rules are described in [Files, Task Bundles, and result storage](/roller/tasks/task-bundle-and-storage/#6-run-and-sample).

## 9. Retry and Resume

`--retries N` reruns the entire dynamic rollout, not only the failed turn. This avoids reusing a session whose conversation state no longer matches.

When the instruction, Simulator model, thinking, `max_turns`, Task Agent inputs, or Context change,
the Task Bundle digest changes and the run-lock check refuses to mix the new configuration into an old run. After the lock matches,
`--resume` reuses only successful samples whose identity and canonical traces pass validation and that also have all of the following files:

- Task Agent raw/ACTF/SFT;
- `conversation.json`;
- Simulator raw/ACTF/SFT;
- digests that match the current task and files.

`conversation.json` and both participants' `info.json` must also have the correct schema and a successful status.
The full rules are described in [Files, Task Bundles, and result storage](/roller/tasks/task-bundle-and-storage/#9-retry-and-resume).

## 10. Current boundaries

- The Task Agent harness can be set per task; an explicit `--harness` overrides every Task Agent. The Simulator harness can be set independently per task;
- The Simulator receives conversation information only through the transcript and does not share the Task Agent's filesystem or tool state;
- The current protocol maps one decision to one user message and does not support multiple simulated users at once;
- `max_turns` is the number of instructions given to the Task Agent and does not include the final `finish` check.

A new Harness must implement the interactive session interface. The Conversation Manager can then reuse its existing turn scheduling, decision protocol, and storage rules.

Hermes retains its container and restores native message history between turns. Each turn starts a new Python agent; process-local state such as background process handles is not restored. See [Hermes](/roller/harnesses/hermes-configuration/).

DeepSeek Harness uses one SDK/runtime process and persistent Bash per participant across turns. See [DeepSeek Harness](/roller/harnesses/deepseek-configuration/).

Pi retains one AgentSession and workspace per participant across turns. Bash Shell state does not persist across calls. See [Pi Agent](/roller/harnesses/pi-configuration/).
