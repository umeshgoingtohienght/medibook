import { initials } from "../utils/format.js";

const HUES = [174, 205, 262, 330, 28, 145, 190, 290];

export default function Avatar({ name = "", size = 48 }) {
  const hue = HUES[[...name].reduce((s, c) => s + c.charCodeAt(0), 0) % HUES.length];
  return (
    <span
      className="avatar"
      aria-hidden="true"
      style={{
        width: size, height: size, fontSize: size * 0.38,
        background: `hsl(${hue} 70% 92%)`, color: `hsl(${hue} 60% 30%)`,
      }}
    >
      {initials(name)}
    </span>
  );
}
