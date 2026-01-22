import React from 'react';
import { Smile, Briefcase, Zap, Check } from 'lucide-react';
import { type PersonaType } from '../types/resume';
import { PERSONAS, PERSONA_LIST } from '../config/personas';

interface PersonaSelectorProps {
  selectedPersona: PersonaType | null;
  onSelect: (persona: PersonaType) => void;
}

const PERSONA_ICONS: Record<PersonaType, React.ReactNode> = {
  friendly: <Smile size={32} />,
  professional: <Briefcase size={32} />,
  challenging: <Zap size={32} />,
};

const PERSONA_COLORS: Record<PersonaType, { bg: string; border: string; accent: string }> = {
  friendly: {
    bg: 'bg-green-50',
    border: 'border-green-500',
    accent: 'text-green-600',
  },
  professional: {
    bg: 'bg-blue-50',
    border: 'border-blue-500',
    accent: 'text-blue-600',
  },
  challenging: {
    bg: 'bg-orange-50',
    border: 'border-orange-500',
    accent: 'text-orange-600',
  },
};

const PersonaSelector: React.FC<PersonaSelectorProps> = ({ selectedPersona, onSelect }) => {
  return (
    <div className="w-full max-w-3xl mx-auto">
      <div className="mb-6">
        <h2 className="text-lg font-mono font-bold uppercase tracking-wide">
          Choose Your Interviewer
        </h2>
        <p className="text-sm text-gray-600 mt-1">
          Select a persona to customize your interview experience
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PERSONA_LIST.map((personaType) => {
          const persona = PERSONAS[personaType];
          const colors = PERSONA_COLORS[personaType];
          const isSelected = selectedPersona === personaType;

          return (
            <button
              key={personaType}
              onClick={() => onSelect(personaType)}
              className={`relative p-6 text-left border-2 transition-all ${
                isSelected
                  ? `${colors.bg} ${colors.border} shadow-retro`
                  : 'bg-white border-black hover:bg-gray-50 shadow-retro-sm hover:shadow-retro'
              }`}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className={`absolute top-3 right-3 ${colors.accent}`}>
                  <Check size={20} />
                </div>
              )}

              {/* Icon */}
              <div className={`mb-4 ${isSelected ? colors.accent : 'text-gray-400'}`}>
                {PERSONA_ICONS[personaType]}
              </div>

              {/* Title */}
              <h3 className="font-mono font-bold text-sm uppercase tracking-wide mb-2">
                {persona.title}
              </h3>

              {/* Description */}
              <p className="text-xs text-gray-600 leading-relaxed">
                {persona.description}
              </p>

              {/* Depth indicator */}
              <div className="mt-4 pt-3 border-t border-gray-200">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono text-gray-400 uppercase">Depth:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3].map((level) => (
                      <div
                        key={level}
                        className={`w-3 h-3 border ${
                          (persona.followUpDepth === 'light' && level <= 1) ||
                          (persona.followUpDepth === 'moderate' && level <= 2) ||
                          (persona.followUpDepth === 'deep' && level <= 3)
                            ? isSelected
                              ? `${colors.border} ${colors.bg.replace('50', '200')}`
                              : 'border-black bg-black'
                            : 'border-gray-300 bg-white'
                        }`}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default PersonaSelector;
