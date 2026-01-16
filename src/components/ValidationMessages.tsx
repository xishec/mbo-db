import type { ErrorSeverity } from "../types/birdEventErrors";

interface ValidationMessagesProps {
  messages: { text: string; severity: ErrorSeverity }[];
  title: string;
  showBackground?: boolean;
}

export default function ValidationMessages({ messages, title, showBackground = false }: ValidationMessagesProps) {
  if (messages.length === 0) return null;

  const containerClasses = showBackground
    ? "text-sm bg-danger-50 border border-danger rounded-lg p-4"
    : "text-sm";

  const titleClasses = showBackground ? "font-semibold text-danger mb-2" : "font-semibold mb-2";

  return (
    <div className={containerClasses}>
      <h4 className={titleClasses}>{title}</h4>
      <ul className="list-disc list-inside">
        {messages.map((message, idx) => (
          <li key={idx} className={message.severity === "danger" ? "text-danger-600" : "text-warning-600"}>
            {message.text}
          </li>
        ))}
      </ul>
    </div>
  );
}
