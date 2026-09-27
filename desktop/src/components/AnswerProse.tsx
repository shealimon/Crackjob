import type { ReactNode } from "react";
import { toSpeakingChunks, type SpeakingChunk } from "../lib/speakingChunks";

function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const re = /(`[^`]+`|\*\*[^*]+\*\*)/g;
  let last = 0;
  let match: RegExpExecArray | null;
  let index = 0;

  while ((match = re.exec(text)) !== null) {
    if (match.index > last) {
      parts.push(text.slice(last, match.index));
    }
    const token = match[0];
    if (token.startsWith("`")) {
      parts.push(
        <strong key={`${keyPrefix}-term-${index}`} className="ic-prose-term">
          {token.slice(1, -1)}
        </strong>,
      );
    } else {
      parts.push(
        <strong key={`${keyPrefix}-bold-${index}`} className="ic-prose-emphasis">
          {token.slice(2, -2)}
        </strong>,
      );
    }
    last = match.index + token.length;
    index += 1;
  }

  if (last < text.length) {
    parts.push(text.slice(last));
  }

  return parts.length ? parts : [text];
}

function renderChunk(chunk: SpeakingChunk, index: number): ReactNode {
  if (chunk.kind === "gap") {
    return <span key={`gap-${index}`} className="ic-prose-gap" aria-hidden />;
  }

  if (chunk.kind === "section") {
    return (
      <h3 key={`sec-${index}`} className="ic-prose-section">
        {chunk.label || chunk.text}
      </h3>
    );
  }

  if (chunk.kind === "followup") {
    return (
      <p key={`fu-${index}`} className="ic-prose-line ic-prose-followup">
        {renderInline(chunk.text, `followup-${index}`)}
      </p>
    );
  }

  if (chunk.kind === "bullet") {
    return (
      <p key={`b-${index}`} className="ic-prose-line ic-prose-bullet">
        {renderInline(chunk.text, `bullet-${index}`)}
      </p>
    );
  }

  if (chunk.kind === "example") {
    return (
      <blockquote key={`ex-${index}`} className="ic-prose-example">
        {chunk.label ? <span className="ic-prose-example-label">{chunk.label}</span> : null}
        <p className="ic-prose-line">
          {renderInline(chunk.text, `example-${index}`)}
        </p>
      </blockquote>
    );
  }

  return (
    <p key={`p-${index}`} className="ic-prose-line">
      {renderInline(chunk.text, `plain-${index}`)}
    </p>
  );
}

export function AnswerProse({
  text,
  streaming = false,
}: {
  text: string;
  streaming?: boolean;
}) {
  const chunks = toSpeakingChunks(text, streaming);

  return <div className="ic-prose">{chunks.map((chunk, index) => renderChunk(chunk, index))}</div>;
}
