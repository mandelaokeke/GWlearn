import type { ReactNode } from "react";
import type { BrowserAWSConfigInput } from "../packages/browser/aws-config";
import { ProductAccount, ProductAuthGate } from "./product-auth";

const links = [
  { href: "/learn", label: "Home" },
  { href: "/learn/library", label: "Browse videos" },
  { href: "/learn/upload", label: "Upload video" },
  { href: "/learn/chat", label: "AI chat" },
];

export function ProductShell({ children, configurationInput }: { children: ReactNode; configurationInput: BrowserAWSConfigInput }) {
  return (
    <div className="product-app">
      <ProductAuthGate configurationInput={configurationInput} />
      <header className="product-header">
        <a className="product-brand" href="/learn"><span className="brand-mark">GW</span><span>GWLearn</span></a>
        <nav aria-label="GWLearn workspace">{links.map((link) => <a href={link.href} key={link.href}>{link.label}</a>)}</nav>
        <ProductAccount configurationInput={configurationInput} />
      </header>
      <main className="product-main">{children}</main>
    </div>
  );
}
