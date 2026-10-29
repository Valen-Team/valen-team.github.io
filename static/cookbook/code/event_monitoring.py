"""Find when things happen in a clip: ask the same questions of evenly spaced frames, then smooth in code. Apache-2.0."""
from common import client, emit, frame_image, image_input, parser, png, request

EVENTS = {
    "plate_served": "A plate of dumplings sits in the middle of the frame.",
    "dumpling_opened": "Two hands hold a single dumpling that is split in half.",
}


def frames(path, count):
    """Evenly spaced frames as PNG bytes with their timestamps; the clip is decoded once."""
    import av
    with av.open(str(path)) as video:
        decoded = [(frame.time, frame_image(frame)) for frame in video.decode(video=0)]
    for i in range(count):
        time, image = decoded[round(i * (len(decoded) - 1) / (count - 1))]
        yield round(float(time), 2), png(image)


def first_seen(timeline, event, hold=2):
    """An event starts at the first of `hold` consecutive frames above 0.7, so one noisy frame is ignored."""
    for i in range(len(timeline) - hold + 1):
        if all(timeline[i + k][event] >= 0.7 for k in range(hold)):
            return timeline[i]["t"]
    return None


def run(predict, path, count=12):
    questions = [{"name": name, "type": "predicate", "instructions": text} for name, text in EVENTS.items()]
    timeline = []
    for t, payload in frames(path, count):
        answers = request(predict, image_input(payload), questions)
        timeline.append({"t": t, **{name: answers[name]["probability"] for name in EVENTS}})
    return {"clip": path.name, "events": {name: first_seen(timeline, name) for name in EVENTS}, "timeline": timeline}


def main():
    args = parser(__doc__).parse_args()
    with client(args) as predict:
        emit(run(predict, args.asset_dir / "momos.mp4"), args)


if __name__ == "__main__":
    main()
