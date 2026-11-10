"""Turn a command into a function call: one request picks the function and every closed-set argument. Apache-2.0."""
import json

from common import HERE, choice_status, client, emit, parser, request

# Each function's closed-set arguments. Free text, numbers and dates stay with code.
TOOLS = {
    "set_reminder": {"description": "Remind or notify the user about this note at a later time",
                     "args": {"when": {"question": "When does the user want the reminder?",
                                       "options": {"later_today": "Later today", "tomorrow": "Tomorrow",
                                                   "next_week": "Some time next week"}}}},
    "share_note": {"description": "Send this note to other people, or let them read or edit it",
                   "args": {"permission": {"question": "What may the other people do with the note?",
                                           "options": {"view": "They can read but not change it",
                                                       "edit": "They can change it"}}}},
    "change_theme": {"description": "Switch the app's colors, such as light or dark mode",
                     "args": {"theme": {"question": "Which colors does the user want the app to use?",
                                        "options": {"light": "Light colors", "dark": "Dark colors",
                                                    "system": "Follow the device setting"}}}},
    "export_note": {"description": "Save or download this note as a file, such as PDF, Markdown or Word",
                    "args": {"format": {"question": "Which file format does the user want?",
                                        "options": {"pdf": "PDF document", "markdown": "Markdown text file",
                                                    "docx": "Word document"}}}},
}
# The state says what the text is: a bare "hello" or "what's the weather" reads differently once it is a command-bar entry.
APP = "Command bar of a notes app, typed while a note is open"


def questions():
    asked = [{"name": "function", "type": "choice", "instructions": "What does the user want the notes app to do?",
              "choices": [{"value": name, "description": tool["description"]} for name, tool in TOOLS.items()]},
             # A choice always picks a function, so a separate predicate tells code when none applies.
             {"name": "is_command", "type": "predicate",
              "instructions": "The message is an instruction for the notes app to carry out."}]
    # Speculative: every function's arguments are asked now; code reads only the chosen function's.
    for name, tool in TOOLS.items():
        for arg, spec in tool["args"].items():
            asked.append({"name": f"{name}.{arg}", "type": "choice", "instructions": spec["question"],
                          "choices": [{"value": value, "description": text} for value, text in spec["options"].items()]})
    return asked


def run(predict, command):
    answers = request(predict, json.dumps({"app": APP, "command": command}, ensure_ascii=False), questions())
    function = answers["function"]
    confidence, certain = choice_status(function)
    is_command = answers["is_command"]["probability"]
    base = {"command": command, "is_command": is_command, "confidence": confidence}
    if is_command < 0.3:
        return {**base, "status": "not_a_command"}
    if not certain:
        if is_command < 0.7:
            return {**base, "status": "show_help"}
        top = sorted(function["probabilities"], key=lambda x: x["probability"], reverse=True)[:2]
        return {**base, "status": "clarify", "options": [x["value"] for x in top]}
    kwargs, unsure = {}, []
    for arg in TOOLS[function["choice"]]["args"]:
        answer = answers[f"{function['choice']}.{arg}"]
        kwargs[arg] = answer["choice"]
        if not choice_status(answer)[1]:
            unsure.append(arg)
    return {**base, "status": "clarify_arguments" if unsure else "call",
            "call": {"function": function["choice"], "kwargs": kwargs}, "unsure": unsure}


def main():
    args = parser(__doc__).parse_args()
    commands = json.loads((HERE / "function_calling_data.json").read_text())
    with client(args) as predict:
        emit([run(predict, command) for command in commands], args)


if __name__ == "__main__":
    main()
