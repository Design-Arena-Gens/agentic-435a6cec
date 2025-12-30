"use client";

import { useCallback, useMemo, useState } from "react";

const prompt = [
  "You are an elite prompt engineer and n8n solutions architect. Generate a complete, copy-pasteable n8n workflow JSON (compatible with n8n v1.36+) that automates long-form YouTube video creation entirely with free, self-hostable tools.",
  "",
  "### Context",
  "- The user self-hosts n8n in Docker with persistent volumes.",
  "- FFmpeg is pre-installed inside the Docker container at `/usr/bin/ffmpeg`.",
  "- Local AI endpoints are reachable from inside the container:",
  "  - Text generation: `http://ollama:11434/api/generate` (default model: `llama3:70b`, streaming disabled).",
  "  - Text-embedding for script structure: `http://ollama:11434/api/embeddings` (model: `mxbai-embed-large`).",
  "  - TTS: `http://coqui-tts:5002/api/tts` (Coqui TTS server with voices `en_US-libritts_r-medium`).",
  "- Background music source: download royalty-free ambient loops from Mixkit CDN (direct download, no key).",
  "- Stock visuals: use `https://samplelib.com/lib/preview/mp4/sample-5s.mp4` as a fallback looping clip and allow user override.",
  "- Only free endpoints, local tools, and Creative Commons Zero assets are allowed. NEVER rely on paid/cloud-only APIs.",
  "",
  "### Objective",
  "Input: a single string topic (e.g., “History of the Silk Road”). Output: a >20-minute narrated video uploaded to YouTube with generated title, description, tags, and thumbnail; log every major step.",
  "",
  "### High-Level Flow (must be mirrored in the workflow)",
  "1. **Trigger & Topic Intake** – Manual Trigger node leading to a Set node that captures:",
  "   ```json",
  "   {",
  '     "topic": "<<<USER_TOPIC>>>",',
  '     "minVideoMinutes": 21,',
  '     "targetAudience": "general knowledge seekers",',
  '     "voiceId": "en_US-libritts_r-medium",',
  '     "backgroundLoopUrl": "https://assets.mixkit.co/music/preview/mixkit-floating-on-a-cloud-1363.mp3",',
  '     "bRollClipUrl": "https://samplelib.com/lib/preview/mp4/sample-5s.mp4"',
  "   }",
  "   ```",
  "2. **Research & Outline** – Call Ollama LLM to produce a structured outline (10+ sections, each with key talking points). Use embeddings to score relevance and ensure total spoken word count >= 2600 (approx 20 mins @ 130wpm).",
  "3. **Script Generation Loop** – For each section, generate a detailed narrative paragraph (~250 words) and store in an Item Lists node. Enforce factual tone, cite inline references, and add cues for visuals.",
  "4. **Voiceover Creation** – Concatenate section texts, send to Coqui TTS chunk-by-chunk (each <= 600 chars) and stitch WAV files with FFmpeg into a single track; normalize loudness to -16 LUFS.",
  "5. **Background Music** – Download ambient loop (ensure sample rate matches voice track), extend via FFmpeg `-stream_loop -1` then trim to match voiceover duration, fade in/out 4 seconds.",
  "6. **Visual Track** –",
  "   - Create simple dynamic slideshow: use LLM to output slide captions & prompts.",
  "   - Generate title cards via ImageMagick (run with Execute Command) using large font on gradient background.",
  "   - Download fallback looping video clip; use FFmpeg filter_complex to overlay captions (subtitles from script) with slow zoom.",
  "7. **Assemble Final Video** –",
  "   - Combine voiceover + background music with `-filter_complex amix` (voice prioritized).",
  "   - Overlay subtitles from `.srt` generated in prior step.",
  "   - Ensure final duration >= requested minutes; if shorter, loop B-roll or insert pause segments to pad.",
  "   - Export to `./data/output/${topicSlug}/${topicSlug}.mp4` in H.264/AAC, 1080p, 24fps.",
  "8. **Metadata Generation** – Produce SEO-friendly title (max 70 chars), description (at least 2,000 chars with chapter timestamps), tags (15-20), and default language info.",
  "9. **YouTube Upload** – Use n8n’s YouTube node in OAuth2 mode (assume credentials already configured). Upload video, apply metadata, set visibility to Unlisted, schedule publish +7 days, and add thumbnail (generated earlier).",
  "10. **Post-Upload Notification** – Send success summary via Email (SMTP node) and log JSON to a local file.",
  "",
  "### Workflow Construction Rules",
  "- Output MUST be a valid n8n JSON export with `\"nodes\"`, `\"connections\"`, credentials placeholders, and pinned data where helpful.",
  "- Use descriptive node names (e.g., “Generate Outline with Ollama”, “Stitch Voiceover in FFmpeg”).",
  "- Include explicit parameter blocks for each node, especially HTTP Requests (method, headers, body).",
  "- Provide command strings exactly, without ellipses. Use multiline shell commands in Execute Command nodes.",
  "- For loops, use SplitInBatches and Merge nodes; illustrate how batches feed into calling TTS and storing results.",
  "- Use n8n Expressions (`{{ }}`) for dynamic values such as file paths, timestamps, durations, and request payloads.",
  "- Add Error Trigger branch documenting retry logic and cleanup (delete temp files).",
  "- Include notes (`Sticky Note` nodes) summarizing configuration tips where needed.",
  "",
  "### Detailed Node Checklist (minimum)",
  "1. Manual Trigger",
  "2. Set Topic Config",
  "3. Generate Outline (HTTP Request → Ollama generate)",
  "4. Validate Outline Length (Function node, throw error if <10 sections or <2600 estimated words)",
  "5. Split Outline Sections (Item Lists)",
  "6. Loop: Section to Script (HTTP Request to Ollama) → Append to master script (Item Lists)",
  "7. Function: Build SRT Subtitle Blocks (approx 150-word chunks with timestamps)",
  "8. SplitInBatches over script chunks for TTS requests",
  "9. HTTP Request to Coqui TTS (returns WAV per chunk → Binary property)",
  "10. Move Binary to Disk (Write Binary File node) in `./data/tmp/voice/{{ $json.filename }}`",
  "11. Execute Command: FFmpeg concat voice chunks (use `ffconcat` intermediate file) → `voiceover.wav`",
  "12. HTTP Request download background music (Mixkit) → Write Binary File",
  "13. Execute Command: Loop & trim music to voice duration, apply fades → `bgm.wav`",
  "14. Execute Command: Generate captions text file `.srt` from JSON data",
  "15. Execute Command: Produce title card PNG using ImageMagick `convert` with gradient",
  "16. HTTP Request: Download fallback B-roll mp4",
  "17. Execute Command: FFmpeg filter_complex to overlay captions + title card + voiceover + bgm → final mp4",
  "18. HTTP Request/Execute Command: Generate thumbnail (extract frame at 5s, overlay title text)",
  "19. HTTP Request: Ollama generate metadata (title, description with timestamps, tags)",
  "20. YouTube Upload node: attach video + metadata + thumbnail",
  "21. Wait node: Query YouTube for processing status, retry up to 5 times",
  "22. Set Publish Schedule (ISO8601) and patch video settings",
  "23. Email node: send summary with output links",
  "24. Write Binary File: archive JSON log of run (include durations and file paths)",
  "25. Error Trigger path with cleanup commands deleting `./data/tmp`.",
  "",
  "### Data Models",
  "- Maintain master JSON object stored in Set node named `Pipeline Context`:",
  "  ```json",
  "  {",
  '    "topic": \"{{ $json.topic }}\",',
  '    "slug": \"{{ $json.topic.replace(/\\W+/g, "-").toLowerCase() }}\",',
  '    "outline": [ { \"heading\": \"\", \"bullets\": [] } ],',
  '    "scriptSections": [ { \"heading\": \"\", \"body\": \"\", \"durationSeconds\": 0 } ],',
  '    "voicePaths": [],',
  '    "musicPath": \"\",',
  '    "videoPath": \"\",',
  '    "thumbnailPath": \"\",',
  '    "metadata": { \"title\": \"\", \"description\": \"\", \"tags\": [] }',
  "  }",
  "  ```",
  "- Show how each node reads/writes this context using expressions.",
  "",
  "### FFmpeg Command Requirements",
  "- Normalize audio via `-filter:a loudnorm=I=-16:TP=-1.5:LRA=11`.",
  "- Use `-shortest` only after guaranteeing voiceover duration >= target minutes; otherwise pad music first.",
  "- Add subtitles with `-vf subtitles={{ $json.subtitleFile }}`.",
  "- Export video using `-c:v libx264 -preset slow -crf 18 -c:a aac -b:a 192k`.",
  "- Include final command exactly as string in Execute Command node parameters.",
  "",
  "### YouTube Metadata Rules",
  "- Title: incorporate topic + hook, <= 70 chars.",
  "- Description:",
  "  - Introduction paragraph with keyword-rich summary.",
  "  - Timestamped chapters every 2-3 minutes derived from script sections.",
  "  - “Resources & Attribution” section listing audio/video sources (Mixkit, samplelib).",
  "  - Call-to-action and hashtags (#history #education etc.).",
  "- Tags: 15-20 semantically rich tags.",
  "- Thumbnail alt text field stored in context for accessibility.",
  "",
  "### Validation & Resilience",
  "- Add IF nodes after each major HTTP/TTS call to verify status codes.",
  "- Implement retry strategy (3 attempts, exponential backoff).",
  "- On failure, run cleanup command `rm -rf ./data/tmp/{{ $json.slug }}` and send alert email.",
  "- Ensure final node returns success JSON with video URL, publish schedule, and duration.",
  "",
  "### Customization Guidance (include as Markdown comment in output)",
  "- Explain how to swap Ollama model (e.g., `mistral-large`) and change voice ID.",
  "- Document how to replace background loop and B-roll URLs.",
  "- Outline optional branch to push metadata to Notion or Google Sheets.",
  "- Note Docker volume paths needed (`/home/node/.n8n/data`).",
  "",
  "### Deliverables Required in Your Response",
  "1. Ready-to-import n8n workflow JSON (single code block).",
  "2. A short “Quick Start” section explaining post-import setup (OAuth, Docker volumes).",
  "3. A “Customization Matrix” table mapping changes (e.g., voice, music, publish delay) to the specific node/field to edit.",
  "",
  "Ensure there are **no placeholders like TODO**. Provide concrete default values and filenames. The final response must let a technically savvy user import the workflow and run it immediately with only the topic input."
].join("\n");

const highlightCards = [
  {
    title: "How to use",
    body:
      "Paste the prompt below into your preferred AI model (GPT, Claude, Gemini, etc.) with reasoning enabled. Ask it to answer in Markdown. Import the resulting JSON into n8n."
  },
  {
    title: "Assumptions",
    body:
      "Workflow runs on self-hosted n8n + Docker with Ollama, Coqui TTS, FFmpeg, and ImageMagick accessible. Modify node parameters if your URLs or paths differ."
  },
  {
    title: "Goal",
    body:
      "Autonomously produce long (>20 min) narrated videos with music, captions, thumbnail, SEO metadata, and publish to YouTube using only free/self-hosted resources."
  }
];

export default function Home() {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 3200);
    } catch (error) {
      console.error("Unable to copy prompt:", error);
      setIsCopied(false);
    }
  }, []);

  const copyLabel = useMemo(
    () => (isCopied ? "Prompt copied!" : "Copy prompt"),
    [isCopied]
  );

  return (
    <main className="app-shell">
      <h1 className="app-title">Agentic n8n YouTube Automation Prompt</h1>
      <p className="app-subtitle">
        Copy this battle-tested prompt into any capable AI model to receive a full
        n8n workflow that scripts, narrates, scores, edits, and uploads long-form
        YouTube videos using only free, self-hosted tools.
      </p>
      <div className="section-grid">
        {highlightCards.map((card) => (
          <article key={card.title} className="copy-card">
            <h2>{card.title}</h2>
            <p>{card.body}</p>
          </article>
        ))}
      </div>
      <section className="prompt-box">
        <textarea
          className="prompt-area"
          value={prompt}
          spellCheck={false}
          readOnly
        />
        <button type="button" className="copy-button" onClick={handleCopy}>
          <span>{isCopied ? "✓" : "📋"}</span>
          {copyLabel}
        </button>
      </section>
      <p className="footnote">
        Need variations? Ask the AI model to adjust the “Customization Guidance”
        section included in the prompt output. Update node names or file paths in
        n8n after import as required.
      </p>
    </main>
  );
}
