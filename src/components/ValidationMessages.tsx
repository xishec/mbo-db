import type { ErrorSeverity } from "../types/birdEventErrors";

interface ValidationMessagesProps {
  messages: { text: string; severity: ErrorSeverity }[];
  title: string;
}

export default function ValidationMessages({ messages, title }: ValidationMessagesProps) {
  if (messages.length === 0) return null;

  const containerClasses = "text-sm border border-danger rounded-medium p-4";

  const titleClasses = "font-semibold mb-2";

  return (
    <div className={containerClasses}>
      <h4 className={titleClasses}>{title}</h4>
      <ul className="list-disc list-inside">
        {messages.map((message, idx) => (
          <li key={idx} className={message.severity === "danger" ? "text-danger" : "text-warning"}>
            {message.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
