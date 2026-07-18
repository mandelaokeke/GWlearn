import type { Metadata } from "next";

export const metadata: Metadata = { title: "Browse videos" };
const lectures = [
  ["Zero Trust Fundamentals", "Cybersecurity 101", "18:42", "Ready"],
  ["Content Marketing Strategy", "Digital Marketing", "06:47", "Demo"],
  ["SEO for Beginners", "Digital Marketing", "01:36", "Demo"],
];

export default function LibraryPage() {
  return <section className="app-page"><div className="app-page-heading"><div><p className="app-kicker">LECTURE LIBRARY</p><h1>Browse videos</h1><p>Choose a lecture to open its transcript and learning tools.</p></div><a className="app-primary-link" href="/learn/upload">Upload new video</a></div><div className="lecture-library">{lectures.map(([title, course, duration, status], index) => <a className="lecture-card" href="/learn/lecture" key={title}><div className={`lecture-thumb lecture-thumb-${index + 1}`}><span>{course}</span><b>▶</b><small>{duration}</small></div><div><span className="lecture-status">{status}</span><h2>{title}</h2><p>{course}</p></div></a>)}</div><p className="demo-note">The first lecture demonstrates the completed workspace. Uploaded lectures are already stored and processed in AWS; a live library read endpoint is the next backend slice.</p></section>;
}
