import { useEffect, useState } from "react";
import { Button } from "@heroui/react";
import { useData } from "../../services/useData";
import ModalShell, { ModalBodyShell, ModalFooterShell } from "../Modals/ModalShell";
import { modalPrimaryButtonProps } from "../Modals/modalDefaults";

const CONFETTI = ["🦅", "🦉", "🦆", "🦢", "🦜", "🦩", "🕊️", "🦃", "🐦‍⬛"];
const PARTICLE_COUNT = 150;

interface Particle {
  id: number;
  emoji: string;
  left: number;
  delay: number;
  duration: number;
  size: number;
}

function generateParticles(): Particle[] {
  return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
    id: i,
    emoji: CONFETTI[Math.floor(Math.random() * CONFETTI.length)],
    left: Math.random() * 100,
    delay: Math.random() * 6,
    duration: 4 + Math.random() * 4,
    size: 25 + Math.random() * 24,
  }));
}

export default function MilestoneCelebration() {
  const { milestone, clearMilestone, volunteersMap } = useData();
  const [particles] = useState(generateParticles);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (milestone) {
      setVisible(true);
    }
  }, [milestone]);

  if (!milestone) return null;

  const bander = volunteersMap[milestone.banderCode];
  const displayName = bander?.fullName || milestone.banderCode;
  const milestoneNumber = milestone.count;

  const handleClose = () => {
    setVisible(false);
    clearMilestone();
  };

  return (
    <>
      {/* Confetti layer — rendered outside the modal so it covers the entire screen */}
      {visible && (
        <div className="fixed inset-0 z-[9999] pointer-events-none">
          {particles.map((p) => (
            <span
              key={p.id}
              className="absolute animate-confetti-fall"
              style={{
                left: `${p.left}%`,
                top: "-5%",
                fontSize: `${p.size}px`,
                animationDelay: `${p.delay}s`,
                animationDuration: `${p.duration}s`,
              }}
            >
              {p.emoji}
            </span>
          ))}
        </div>
      )}

      <ModalShell
        modalProps={{
          isOpen: visible,
          onOpenChange: (open) => { if (!open) handleClose(); },
          placement: "center",
          isDismissable: true,
        }}
      >
        <ModalBodyShell>
          <div className="text-center py-8">
            <div className="text-6xl mb-4">🏆</div>
            <h1 className="text-4xl font-bold text-default-900 mb-2">Milestone!</h1>
            <p className="text-2xl text-primary font-semibold mb-1">{displayName}</p>
            <p className="text-5xl font-black text-secondary my-4">{milestoneNumber.toLocaleString()}</p>
            <p className="text-xl text-default-700">birds banded!</p>
          </div>
        </ModalBodyShell>
        <ModalFooterShell>
          <Button {...modalPrimaryButtonProps} onPress={handleClose} className="w-full">
            Celebrate!
          </Button>
        </ModalFooterShell>
      </ModalShell>
    </>
  );
}
