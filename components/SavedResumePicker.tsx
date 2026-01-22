import React from 'react';
import { FileText, ArrowRight, Trash2 } from 'lucide-react';
import { type ResumeData } from '../types/resume';
import { type StoredResume } from '../packages/storage/src/indexedDB';

interface SavedResumePickerProps {
  resumes: StoredResume[];
  onSelectResume: (resumeData: ResumeData) => void;
  onDeleteResume?: (id: string) => void;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

const SavedResumePicker: React.FC<SavedResumePickerProps> = ({
  resumes,
  onSelectResume,
  onDeleteResume,
}) => {
  if (resumes.length === 0) {
    return null;
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="border-t-2 border-gray-300 pt-6">
        <p className="text-sm font-mono text-gray-500 uppercase tracking-wide mb-4">
          Or use a saved resume
        </p>

        <div className="space-y-3">
          {resumes.map((stored) => {
            const { id, data: resumeData, lastUsed } = stored;
            const topSkills = resumeData.skills.slice(0, 3);
            const experienceCount = resumeData.experience.length;

            return (
              <div
                key={id}
                className="border-2 border-black bg-white p-4 shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 min-w-0 flex-1">
                    <div className="p-2 bg-gray-100 border-2 border-black shrink-0">
                      <FileText size={20} />
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-mono font-bold text-sm truncate">
                        {resumeData.name}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1 truncate">
                        {topSkills.length > 0 && (
                          <>
                            {topSkills.join(', ')}
                            {resumeData.skills.length > 3 && (
                              <span className="text-gray-400">
                                {' '}+{resumeData.skills.length - 3} more
                              </span>
                            )}
                          </>
                        )}
                        {topSkills.length > 0 && experienceCount > 0 && ' • '}
                        {experienceCount > 0 && (
                          <span>
                            {experienceCount} experience{experienceCount !== 1 ? 's' : ''}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-1 font-mono">
                        Last used: {formatDate(lastUsed)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {onDeleteResume && (
                      <button
                        onClick={() => onDeleteResume(id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 border-2 border-transparent hover:border-red-200 transition-colors"
                        title="Delete resume"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                    <button
                      onClick={() => onSelectResume(resumeData)}
                      className="px-4 py-2 bg-black text-white font-mono text-xs uppercase tracking-wide border-2 border-black hover:bg-white hover:text-black transition-colors flex items-center gap-2"
                    >
                      Use
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default SavedResumePicker;
