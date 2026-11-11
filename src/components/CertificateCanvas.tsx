"use client";

import React, { useRef } from "react";
import { PositionsConfig } from "@/types";

interface Props {
  templateUrl: string | null;
  positions: PositionsConfig;
  onPositionChange: (positions: PositionsConfig) => void;
}

export default function CertificateCanvas({
  templateUrl,
  positions,
  onPositionChange,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const draggingTargetRef = useRef<"name" | "role" | null>(null);

  const W = 297;
  const H = 210;

  const handlePointerDown = (
    target: "name" | "role",
    e: React.PointerEvent<HTMLDivElement>
  ) => {
    e.preventDefault();
    draggingTargetRef.current = target;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!draggingTargetRef.current || !containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return;

    // Hitung posisi dalam milimeter A4 (297x210)
    let newX = ((e.clientX - rect.left) / rect.width) * W;
    let newY = ((e.clientY - rect.top) / rect.height) * H;

    // Batasi agar tidak keluar kanvas
    newX = Math.max(10, Math.min(W - 10, Math.round(newX)));
    newY = Math.max(10, Math.min(H - 10, Math.round(newY)));

    const target = draggingTargetRef.current;
    const updated: PositionsConfig = {
      ...positions,
      [target]: {
        ...positions[target],
        x: newX,
        y: newY,
      },
    };
    onPositionChange(updated);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingTargetRef.current) {
      draggingTargetRef.current = null;
      try {
        (e.target as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}
    }
  };

  // Hitung persentase untuk CSS style
  const nameLeft = `${(positions.name.x / W) * 100}%`;
  const nameTop = `${(positions.name.y / H) * 100}%`;
  const roleLeft = `${(positions.role.x / W) * 100}%`;
  const roleTop = `${(positions.role.y / H) * 100}%`;

  return (
    <div
      ref={containerRef}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      className="cert-canvas"
    >
      {templateUrl ? (
        <img
          src={templateUrl}
          alt="Template Latar Sertifikat"
          className="w-full h-full object-cover select-none pointer-events-none"
        />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-[#FAEFDC] border-[10px] border-[#BA7517]/30">
          <p className="text-sm font-semibold text-amber-900">
            Belum ada template latar HD yang diunggah
          </p>
          <span className="text-xs text-amber-800/80 mt-1">
            Unggah gambar PNG atau JPG pada tombol di bawah untuk pratinjau kanvas sebenarnya.
          </span>
        </div>
      )}

      {/* Draggable: Nama Peserta */}
      <div
        onPointerDown={(e) => handlePointerDown("name", e)}
        style={{
          left: nameLeft,
          top: nameTop,
          color: positions.color || "#1E255E",
          fontSize: `${Math.max(12, Math.min(30, positions.name.size * 0.55))}px`,
        }}
        className="draggable-element font-serif italic font-bold tracking-wide"
        title="Geser posisi Nama Peserta"
      >
        Nama Lengkap Peserta
      </div>

      {/* Draggable: Peran Peserta */}
      <div
        onPointerDown={(e) => handlePointerDown("role", e)}
        style={{
          left: roleLeft,
          top: roleTop,
          color: positions.color || "#1E255E",
          fontSize: `${Math.max(10, Math.min(22, positions.role.size * 0.55))}px`,
        }}
        className="draggable-element font-serif font-bold tracking-wide"
        title="Geser posisi Peran Peserta"
      >
        Sebagai Peran
      </div>
    </div>
  );
}

