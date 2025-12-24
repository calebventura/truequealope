"use client";

import { useState, useRef } from "react";
import Image from "next/image";

interface ImageCarouselProps {
  images: string[];
  alt: string;
}

export function ImageCarousel({ images, alt }: ImageCarouselProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  const handlePrev = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  };

  const handleDotClick = (e: React.MouseEvent, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentIndex(index);
  };

  // Touch handlers for swipe
  const onTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.targetTouches[0].clientX;
  };

  const onTouchMove = (e: React.TouchEvent) => {
    touchEndX.current = e.targetTouches[0].clientX;
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartX.current || !touchEndX.current) return;
    
    const distance = touchStartX.current - touchEndX.current;
    const isLeftSwipe = distance > 50;
    const isRightSwipe = distance < -50;

    if (isLeftSwipe) {
      handleNext();
    } else if (isRightSwipe) {
      handlePrev();
    }

    touchStartX.current = null;
    touchEndX.current = null;
  };

  // Dots logic
  const maxDots = 5;
  const totalImages = images.length;
  
  let startDot = 0;
  if (totalImages > maxDots) {
    if (currentIndex <= 2) {
      startDot = 0;
    } else if (currentIndex >= totalImages - 3) {
      startDot = totalImages - maxDots;
    } else {
      startDot = currentIndex - 2;
    }
  }
  
  const visibleDots = Array.from({ length: Math.min(totalImages, maxDots) }, (_, i) => startDot + i);

  return (
    <div 
      className="relative w-full h-full touch-pan-y group"
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <Image
        src={images[currentIndex]}
        alt={`${alt} - Imagen ${currentIndex + 1}`}
        fill
        className="object-cover transition-transform duration-200"
        sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
      />
      
      {/* Navigation Arrows (Hidden on mobile, visible on hover on desktop) */}
      <button
        onClick={handlePrev}
        className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1.5 transition-opacity z-10 hidden sm:block opacity-0 group-hover:opacity-100"
        aria-label="Anterior imagen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
      </button>
      <button
        onClick={handleNext}
        className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/30 hover:bg-black/50 text-white rounded-full p-1.5 transition-opacity z-10 hidden sm:block opacity-0 group-hover:opacity-100"
        aria-label="Siguiente imagen"
      >
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
        </svg>
      </button>

      {/* Dots */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-0.5 bg-black/20 px-1.5 py-0.5 rounded-full backdrop-blur-[2px] z-10" onClick={(e) => e.stopPropagation()}>
        {visibleDots.map((dotIndex) => (
          <button
            key={dotIndex}
            onClick={(e) => handleDotClick(e, dotIndex)}
            className="p-1.5 focus:outline-none group/dot"
            aria-label={`Ir a imagen ${dotIndex + 1}`}
          >
            <div className={`w-1.5 h-1.5 rounded-full transition-all ${
              dotIndex === currentIndex ? "bg-white scale-125" : "bg-white/50 group-hover/dot:bg-white/80"
            }`} />
          </button>
        ))}
      </div>
    </div>
  );
}
