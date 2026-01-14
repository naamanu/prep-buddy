import React from 'react';

interface DurationPickerProps {
  duration: number;
  onDurationChange: (duration: number) => void;
  options?: number[];
  label?: string;
}

const DurationPicker: React.FC<DurationPickerProps> = ({
  duration,
  onDurationChange,
  options = [15, 30, 45, 60],
  label = 'Interview Duration',
}) => {
  return (
    <div className="max-w-3xl mx-auto">
      <h3 className="text-lg font-mono font-bold uppercase tracking-wide mb-4">
        {label}
      </h3>
      <div className="flex gap-3">
        {options.map((mins) => (
          <button
            key={mins}
            onClick={() => onDurationChange(mins)}
            className={`flex-1 px-4 py-3 font-mono text-sm uppercase tracking-wide border-2 border-black transition-all ${
              duration === mins
                ? 'bg-black text-white shadow-retro'
                : 'bg-white text-black shadow-retro-sm hover:shadow-retro'
            }`}
          >
            {mins} min
          </button>
        ))}
      </div>
    </div>
  );
};

export default DurationPicker;
