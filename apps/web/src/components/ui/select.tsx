export function Select({ value, onChange, options }: { value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 w-full rounded-lg border bg-white px-3 text-[13px] outline-none focus:border-brand focus:ring-2 focus:ring-brand/10 sm:h-10">
      {options.map((option) => (
        <option key={option.value} value={option.value}>{option.label}</option>
      ))}
    </select>
  );
}
