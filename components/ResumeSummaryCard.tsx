import React, { useState } from 'react';
import { X, Edit2, Check, AlertCircle, Briefcase, GraduationCap, FolderOpen, Wrench } from 'lucide-react';
import { type ResumeData, type WorkExperience, type Education, type Project } from '../types/resume';

interface ResumeSummaryCardProps {
  resumeData: ResumeData;
  onUpdate: (data: ResumeData) => void;
  onConfirm: () => void;
  onReset: () => void;
}

const ResumeSummaryCard: React.FC<ResumeSummaryCardProps> = ({
  resumeData,
  onUpdate,
  onConfirm,
  onReset,
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<ResumeData>(resumeData);
  const [showAllSkills, setShowAllSkills] = useState(false);

  const handleRemoveSkill = (index: number) => {
    const newSkills = [...editedData.skills];
    newSkills.splice(index, 1);
    setEditedData({ ...editedData, skills: newSkills });
  };

  const handleRemoveExperience = (index: number) => {
    const newExperience = [...editedData.experience];
    newExperience.splice(index, 1);
    setEditedData({ ...editedData, experience: newExperience });
  };

  const handleRemoveEducation = (index: number) => {
    const newEducation = [...editedData.education];
    newEducation.splice(index, 1);
    setEditedData({ ...editedData, education: newEducation });
  };

  const handleRemoveProject = (index: number) => {
    const newProjects = [...editedData.projects];
    newProjects.splice(index, 1);
    setEditedData({ ...editedData, projects: newProjects });
  };

  const handleEditField = (field: keyof ResumeData, value: string) => {
    setEditedData({ ...editedData, [field]: value });
  };

  const handleSaveEdits = () => {
    onUpdate(editedData);
    setIsEditing(false);
  };

  const handleCancelEdits = () => {
    setEditedData(resumeData);
    setIsEditing(false);
  };

  const displayedSkills = showAllSkills ? editedData.skills : editedData.skills.slice(0, 6);
  const remainingSkillsCount = editedData.skills.length - 6;

  const hasMinimumData = editedData.name && editedData.name !== 'Unknown';

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="border-2 border-black shadow-retro-lg bg-white">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b-2 border-black bg-black text-white">
          <h2 className="text-sm font-bold font-mono uppercase tracking-wide">
            Resume Summary
          </h2>
          <div className="flex items-center gap-2">
            {isEditing ? (
              <>
                <button
                  onClick={handleCancelEdits}
                  className="p-1.5 text-white hover:bg-white hover:text-black border border-transparent hover:border-white transition-colors"
                  title="Cancel"
                >
                  <X size={16} />
                </button>
                <button
                  onClick={handleSaveEdits}
                  className="p-1.5 text-white hover:bg-white hover:text-black border border-transparent hover:border-white transition-colors"
                  title="Save"
                >
                  <Check size={16} />
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setIsEditing(true)}
                  className="p-1.5 text-white hover:bg-white hover:text-black border border-transparent hover:border-white transition-colors"
                  title="Edit"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  onClick={onReset}
                  className="px-2 py-1 text-xs font-mono uppercase tracking-wide hover:bg-white hover:text-black border border-transparent hover:border-white transition-colors"
                >
                  Clear
                </button>
              </>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Name */}
          <div>
            <label className="block text-xs font-mono uppercase tracking-wide text-gray-500 mb-2">
              Name
            </label>
            {isEditing ? (
              <input
                type="text"
                value={editedData.name}
                onChange={(e) => handleEditField('name', e.target.value)}
                className="w-full px-3 py-2 border-2 border-black font-mono text-lg focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2"
              />
            ) : (
              <p className="font-mono text-lg font-bold">{editedData.name}</p>
            )}
          </div>

          {/* Skills */}
          {editedData.skills.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Wrench size={14} className="text-gray-500" />
                <label className="text-xs font-mono uppercase tracking-wide text-gray-500">
                  Skills
                </label>
              </div>
              <div className="flex flex-wrap gap-2">
                {displayedSkills.map((skill, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-gray-100 border-2 border-black text-sm font-mono"
                  >
                    {skill}
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveSkill(index)}
                        className="ml-1 text-gray-500 hover:text-red-500"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </span>
                ))}
                {!showAllSkills && remainingSkillsCount > 0 && (
                  <button
                    onClick={() => setShowAllSkills(true)}
                    className="px-3 py-1 bg-white border-2 border-dashed border-gray-400 text-sm font-mono text-gray-600 hover:border-black hover:text-black transition-colors"
                  >
                    +{remainingSkillsCount} more
                  </button>
                )}
                {showAllSkills && editedData.skills.length > 6 && (
                  <button
                    onClick={() => setShowAllSkills(false)}
                    className="px-3 py-1 bg-white border-2 border-dashed border-gray-400 text-sm font-mono text-gray-600 hover:border-black hover:text-black transition-colors"
                  >
                    Show less
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Experience */}
          {editedData.experience.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Briefcase size={14} className="text-gray-500" />
                <label className="text-xs font-mono uppercase tracking-wide text-gray-500">
                  Experience
                </label>
              </div>
              <div className="space-y-2">
                {editedData.experience.map((exp: WorkExperience, index: number) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 bg-gray-50 border-l-4 border-black"
                  >
                    <div>
                      <p className="font-mono font-bold text-sm">{exp.title}</p>
                      <p className="text-sm text-gray-600">
                        {exp.company}
                        {exp.startDate && (
                          <span className="ml-2 text-gray-400">
                            ({exp.startDate} - {exp.endDate || 'Present'})
                          </span>
                        )}
                      </p>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveExperience(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {editedData.education.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <GraduationCap size={14} className="text-gray-500" />
                <label className="text-xs font-mono uppercase tracking-wide text-gray-500">
                  Education
                </label>
              </div>
              <div className="space-y-2">
                {editedData.education.map((edu: Education, index: number) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 bg-gray-50 border-l-4 border-black"
                  >
                    <div>
                      <p className="font-mono font-bold text-sm">{edu.degree}</p>
                      <p className="text-sm text-gray-600">
                        {edu.school}
                        {edu.year && <span className="ml-2 text-gray-400">({edu.year})</span>}
                        {edu.gpa && <span className="ml-2 text-gray-400">GPA: {edu.gpa}</span>}
                      </p>
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveEducation(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Projects */}
          {editedData.projects.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <FolderOpen size={14} className="text-gray-500" />
                <label className="text-xs font-mono uppercase tracking-wide text-gray-500">
                  Projects
                </label>
              </div>
              <div className="space-y-2">
                {editedData.projects.map((proj: Project, index: number) => (
                  <div
                    key={index}
                    className="flex items-start justify-between p-3 bg-gray-50 border-l-4 border-black"
                  >
                    <div>
                      <p className="font-mono font-bold text-sm">{proj.name}</p>
                      {proj.technologies.length > 0 && (
                        <p className="text-xs text-gray-500 mt-1">
                          {proj.technologies.join(', ')}
                        </p>
                      )}
                    </div>
                    {isEditing && (
                      <button
                        onClick={() => handleRemoveProject(index)}
                        className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Warning */}
          <div className="flex items-start gap-3 p-4 bg-yellow-50 border-2 border-yellow-400">
            <AlertCircle size={20} className="text-yellow-600 shrink-0 mt-0.5" />
            <p className="text-sm text-yellow-800">
              Review the extracted data above. Click Edit to remove anything that was incorrectly parsed.
            </p>
          </div>

          {/* Confirm Button */}
          <button
            onClick={onConfirm}
            disabled={!hasMinimumData || isEditing}
            className="w-full px-4 py-3 bg-black text-white font-mono text-sm uppercase tracking-wide border-2 border-black shadow-retro hover:translate-x-0.5 hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:translate-x-0 disabled:hover:translate-y-0 disabled:hover:shadow-retro"
          >
            Continue to Setup
          </button>
        </div>
      </div>
    </div>
  );
};

export default ResumeSummaryCard;
