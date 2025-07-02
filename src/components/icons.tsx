import type { SVGProps } from "react";

export function StockPilotLogo(props: SVGProps<SVGSVGElement>) {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            {...props}
        >
            <path d="M12 22V8" />
            <path d="M5 12H2a1 1 0 0 0-1 1v3a1 1 0 0 0 1 1h3" />
            <path d="M19 12h3a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-3" />
            <path d="M22 12V6.5A2.5 2.5 0 0 0 19.5 4h-15A2.5 2.5 0 0 0 2 6.5V12" />
            <path d="M12 8L18 2" />
            <path d="M12 8L6 2" />
        </svg>
    )
}
