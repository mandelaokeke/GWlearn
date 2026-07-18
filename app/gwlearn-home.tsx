"use client";

import { useState } from "react";
import { UploadWorkspace } from "./upload-workspace";
import type { BrowserAWSConfigInput } from "../packages/browser/aws-config";

type Experience = "student" | "faculty";

const experiences = {
  student: {
    label: "Student",
    eyebrow: "Your lecture, finally organized",
    headline: "Turn every lecture into a learning system.",
    description:
      "Upload once. GWLearn builds a timestamped transcript, a clear summary, a study guide, and flashcards—then answers questions using the lecture itself.",
    action: "Explore student workspace",
    tools: ["Lecture summary", "Study guide", "Flashcards"],
  },
  faculty: {
    label: "Faculty",
    eyebrow: "Teach from the content you already have",
    headline: "Turn one lecture into the next class plan.",
    description:
      "Transform recorded lectures into structured lesson plans, knowledge checks, and reading prompts while keeping every result tied to the source material.",
    action: "Explore faculty workspace",
    tools: ["Lesson plan", "Knowledge check", "Reading prompts"],
  },
} as const;

const transcript = [
  {
    time: "00:42",
    text: "A zero-trust model starts with a simple assumption: no request is trusted by default.",
  },
  {
    time: "01:18",
    text: "Identity, device posture, and context are evaluated before access is granted.",
  },
  {
    time: "02:07",
    text: "The practical goal is not zero access. It is continuously verified, least-privilege access.",
  },
] as const;

export function GWLearnHome({
  awsConfiguration,
}: {
  awsConfiguration?: BrowserAWSConfigInput;
}) {
  const [experience, setExperience] = useState<Experience>("student");
  const [menuOpen, setMenuOpen] = useState(false);
  const content = experiences[experience];

  return (
    <main>
      <div className="announcement">
        <span>GWLearn is being rebuilt in public</span>
        <a href="#architecture">View the AWS rebuild plan</a>
      </div>

      <header className="site-header">
        <a className="brand" href="#top" aria-label="GWLearn home">
          <span className="brand-mark" aria-hidden="true">GW</span>
          <span>GWLearn</span>
        </a>

        <button
          className="menu-button"
          type="button"
          aria-label="Toggle navigation"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>

        <nav className={menuOpen ? "nav-links nav-links-open" : "nav-links"} aria-label="Primary navigation">
          <a href="#workspace">Workspace</a>
          <a href="#workflow">How it works</a>
          <a href="#architecture">Architecture</a>
          <a className="nav-cta" href="#upload">Upload a lecture</a>
        </nav>
      </header>

      <section className="hero" id="top">
        <div className="hero-copy">
          <div className="experience-switch" role="group" aria-label="Choose your GWLearn experience">
            {(Object.keys(experiences) as Experience[]).map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={experience === option}
                className={experience === option ? "switch-active" : ""}
                onClick={() => setExperience(option)}
              >
                {experiences[option].label}
              </button>
            ))}
          </div>

          <p className="eyebrow">{content.eyebrow}</p>
          <h1>{content.headline}</h1>
          <p className="hero-description">{content.description}</p>

          <div className="hero-actions">
            <a className="primary-button" href="#upload">{content.action}</a>
            <a className="text-link" href="#workflow">See the 3-step workflow <span aria-hidden="true">→</span></a>
          </div>

          <dl className="proof-points">
            <div>
              <dt>Source-grounded</dt>
              <dd>Answers point back to timestamps</dd>
            </div>
            <div>
              <dt>Built for focus</dt>
              <dd>One lecture, every study tool</dd>
            </div>
          </dl>
        </div>

        <div className="product-stage" id="demo" aria-label="GWLearn workspace preview">
          <div className="stage-glow stage-glow-one" />
          <div className="stage-glow stage-glow-two" />
          <div className="app-window">
            <div className="window-bar">
              <div className="window-brand"><span>GW</span> Lecture workspace</div>
              <div className="window-status"><span /> Processing complete</div>
            </div>

            <div className="workspace-grid">
              <section className="video-panel" aria-label="Lecture video">
                <div className="video-frame">
                  <div className="video-kicker">CYBERSECURITY 101</div>
                  <div className="play-button" aria-hidden="true">▶</div>
                  <div className="video-title">Zero Trust Fundamentals</div>
                  <div className="video-progress"><span /></div>
                  <div className="video-time">02:18 / 18:42</div>
                </div>

                <div className="lecture-meta">
                  <div>
                    <span className="meta-label">LECTURE</span>
                    <strong>Zero Trust Fundamentals</strong>
                  </div>
                  <span aria-hidden="true">•••</span>
                </div>
              </section>

              <section className="transcript-panel" aria-label="Lecture transcript">
                <div className="panel-heading">
                  <div>
                    <span className="meta-label">LIVE TRANSCRIPT</span>
                    <h2>Follow the source</h2>
                  </div>
                  <span className="search-chip">Search transcript</span>
                </div>

                <div className="transcript-list">
                  {transcript.map((line, index) => (
                    <div className={index === 1 ? "transcript-line transcript-active" : "transcript-line"} key={line.time}>
                      <span>{line.time}</span>
                      <p>{line.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="tool-row">
              <div className="tool-label">
                <span>AI TOOLS</span>
                <strong>Ready when you are</strong>
              </div>
              {content.tools.map((tool, index) => (
                <div className={index === 0 ? "tool-card tool-card-active" : "tool-card"} key={tool}>
                  <span className="tool-icon" aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
                  <span>{tool}</span>
                  <span aria-hidden="true">↗</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <UploadWorkspace configurationInput={awsConfiguration} />

      <section className="workspace-section" id="workspace">
        <div className="section-heading">
          <p className="eyebrow">A calmer way to learn from video</p>
          <h2>Everything useful stays connected to the lecture.</h2>
          <p>GWLearn turns passive playback into a workspace where every generated resource can be traced back to what was actually said.</p>
        </div>

        <div className="feature-grid">
          <article className="feature-card feature-card-large">
            <span className="feature-number">01</span>
            <div>
              <p className="feature-kicker">TIMESTAMPED TRANSCRIPT</p>
              <h3>Find the moment, not just the phrase.</h3>
              <p>Search the transcript, jump to the exact point in the lecture, and keep the speaker’s context intact.</p>
            </div>
            <div className="mini-transcript" aria-hidden="true">
              <span>08:32</span>
              <p><mark>Least privilege</mark> means access is granted only for the task at hand…</p>
            </div>
          </article>

          <article className="feature-card">
            <span className="feature-number">02</span>
            <div>
              <p className="feature-kicker">STRUCTURED OUTPUTS</p>
              <h3>Study tools with a reason to exist.</h3>
              <p>Summaries, guides, flashcards, and lesson plans share one source instead of inventing disconnected material.</p>
            </div>
          </article>

          <article className="feature-card feature-card-dark">
            <span className="feature-number">03</span>
            <div>
              <p className="feature-kicker">GROUNDED CHAT</p>
              <h3>Ask the lecture. Check the answer.</h3>
              <p>Every answer is bounded by the selected lecture and can include timestamp references for fast verification.</p>
            </div>
            <div className="chat-preview">
              <span className="chat-question">Why is identity central to zero trust?</span>
              <span className="chat-answer">Because each request is verified against identity and context before access is granted. <b>01:18</b></span>
            </div>
          </article>
        </div>
      </section>

      <section className="workflow-section" id="workflow">
        <div className="workflow-copy">
          <p className="eyebrow">From recording to ready</p>
          <h2>Three steps. No tab maze.</h2>
          <p>The rebuild makes every long-running step visible, recoverable, and safe to retry.</p>
        </div>

        <ol className="workflow-list">
          <li>
            <span>01</span>
            <div><h3>Upload directly</h3><p>The browser sends the video to private object storage using short-lived access.</p></div>
          </li>
          <li>
            <span>02</span>
            <div><h3>Watch progress</h3><p>Transcription and AI generation run asynchronously with durable status and useful failures.</p></div>
          </li>
          <li>
            <span>03</span>
            <div><h3>Learn from one source</h3><p>Read, search, generate, and ask questions without losing the lecture context.</p></div>
          </li>
        </ol>
      </section>

      <section className="architecture-section" id="architecture">
        <div className="architecture-copy">
          <p className="eyebrow">Rebuilt for reliability</p>
          <h2>A portfolio project with production-shaped decisions.</h2>
          <p>The new GWLearn replaces the fragile synchronous pipeline with an observable AWS workflow and typed boundaries from interface to infrastructure.</p>
          <a className="text-link text-link-light" href="https://github.com/mandelaokeke/GWlearn">Follow the rebuild on GitHub <span aria-hidden="true">↗</span></a>
        </div>

        <div className="architecture-map" aria-label="Planned AWS architecture">
          <div className="architecture-node architecture-node-main"><small>INTERFACE</small><strong>TypeScript web app</strong><span>Accessible, responsive workspace</span></div>
          <div className="architecture-connector"><span /></div>
          <div className="architecture-services">
            <div className="architecture-node"><small>IDENTITY</small><strong>Amazon Cognito</strong></div>
            <div className="architecture-node"><small>MEDIA</small><strong>Amazon S3</strong></div>
            <div className="architecture-node"><small>STATE</small><strong>DynamoDB</strong></div>
            <div className="architecture-node"><small>WORKFLOW</small><strong>Step Functions</strong></div>
            <div className="architecture-node architecture-node-accent"><small>INTELLIGENCE</small><strong>Transcribe + Bedrock</strong></div>
          </div>
        </div>
      </section>

      <footer>
        <a className="brand brand-footer" href="#top"><span className="brand-mark">GW</span><span>GWLearn</span></a>
        <p>From a 2024 classroom prototype to a production-shaped portfolio rebuild.</p>
        <a href="https://github.com/mandelaokeke/GWlearn">GitHub ↗</a>
      </footer>
    </main>
  );
}
