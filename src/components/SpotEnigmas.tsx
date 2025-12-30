import { useEffect, useState } from "react";
import { getEnigmasForSpot, type Enigma } from "../services/enigmas";
import { completeQuest } from "../services/gamification";
import { auth } from "../lib/firebase";

type SpotEnigmasProps = {
  spotId: string;
};

export default function SpotEnigmas({ spotId }: SpotEnigmasProps) {
  const [enigmas, setEnigmas] = useState<Enigma[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<Record<string, string>>({});

  useEffect(() => {
    getEnigmasForSpot(spotId)
      .then(setEnigmas)
      .catch(console.error);
  }, [spotId]);

  const handleSubmit = async (enigma: Enigma) => {
    const user = auth.currentUser;
    if (!user) {
      setStatus((prev) => ({
        ...prev,
        [enigma.id]: "Tu dois être connecté(e) pour valider l'énigme.",
      }));
      return;
    }

    const raw = answers[enigma.id] ?? "";
    const normalized = raw.trim().toLowerCase();
    const expected = (enigma.answerKeyword ?? "").trim().toLowerCase();

    if (!normalized) {
      setStatus((prev) => ({
        ...prev,
        [enigma.id]: "Entre une réponse.",
      }));
      return;
    }

    if (normalized === expected) {
      try {
        await completeQuest(user.uid, enigma.id, enigma.xpReward);
        setStatus((prev) => ({
          ...prev,
          [enigma.id]: `Bravo, énigme résolue ! +${enigma.xpReward} XP`,
        }));
      } catch (e) {
        console.error(e);
        setStatus((prev) => ({
          ...prev,
          [enigma.id]: "Erreur lors de la validation.",
        }));
      }
    } else {
      setStatus((prev) => ({
        ...prev,
        [enigma.id]: "Réponse incorrecte, réessaie.",
      }));
    }
  };

  if (!enigmas.length) return null;

  return (
    <div className="spot-enigmas">
      <h3>Énigmes urbex</h3>
      {enigmas.map((enigma) => (
        <div key={enigma.id} className="spot-enigma-item">
          <div className="spot-enigma-title">{enigma.title}</div>
          <div className="spot-enigma-hint">{enigma.hint}</div>
          <div className="spot-enigma-input-row">
            <input
              type="text"
              placeholder="Ta réponse"
              value={answers[enigma.id] ?? ""}
              onChange={(e) =>
                setAnswers((prev) => ({
                  ...prev,
                  [enigma.id]: e.target.value,
                }))
              }
            />
            <button onClick={() => handleSubmit(enigma)}>Valider</button>
          </div>
          {status[enigma.id] && (
            <div className="spot-enigma-status">{status[enigma.id]}</div>
          )}
        </div>
      ))}
    </div>
  );
}
