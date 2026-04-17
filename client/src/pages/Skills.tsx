import { useEffect, useState } from "react";
import { getSkills } from "@/lib/api";
import type { Skill } from "@/types/api";
import { Puzzle, ChevronDown, ChevronRight, Loader2, AlertCircle } from "lucide-react";

export default function Skills() {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getSkills()
      .then(setSkills)
      .catch((e: unknown) =>
        setError(e instanceof Error ? e.message : "Failed to load skills"),
      )
      .finally(() => setLoading(false));
  }, []);

  function toggle(name: string) {
    setExpanded((prev) => (prev === name ? null : name));
  }

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-semibold text-gray-100">Skills</h2>
        <p className="text-sm text-gray-500 mt-0.5">
          Agent capabilities and instructions
        </p>
      </div>

      {error && (
        <div className="flex items-center gap-2 text-sm text-red-400 bg-red-950/30 border border-red-800/50 rounded-md p-3">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading…
        </div>
      ) : skills.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-gray-600 gap-2">
          <Puzzle className="w-6 h-6" />
          <p className="text-sm">No skills configured</p>
        </div>
      ) : (
        <div className="space-y-2">
          {skills.map((skill) => (
            <div
              key={skill.name}
              className="bg-gray-900 border border-gray-800 rounded-lg overflow-hidden"
            >
              <button
                onClick={() => toggle(skill.name)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-gray-800/50 transition-colors"
              >
                <Puzzle className="w-4 h-4 text-blue-400 shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-200">{skill.name}</p>
                  {skill.description && (
                    <p className="text-xs text-gray-500 truncate mt-0.5">
                      {skill.description}
                    </p>
                  )}
                </div>
                {skill.instructions ? (
                  expanded === skill.name ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )
                ) : null}
              </button>

              {expanded === skill.name && skill.instructions && (
                <div className="px-4 pb-4 border-t border-gray-800">
                  <pre className="mt-3 text-xs text-gray-400 whitespace-pre-wrap font-mono leading-relaxed">
                    {skill.instructions}
                  </pre>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
