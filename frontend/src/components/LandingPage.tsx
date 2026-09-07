import { useState, type KeyboardEvent } from "react";
import { SIGN_IN_NOTICE } from "../guestChrome";

interface LandingPageProps {
  completed: boolean;
  onStart: () => void;
}

const slides = [
  {
    image: "/placeholders/specimen-12-eval-row.jpg",
    imageAlt: "Engine evaluation row preview",
    title: "[COPY-PLACEHOLDER] Review both boards as one game.",
    body: "[COPY-PLACEHOLDER] Rebuild the timing, transfers, and decisions that shaped your Bughouse result.",
  },
  {
    image: "/placeholders/specimen-21-analysis-panel.jpg",
    imageAlt: "Engine analysis panel preview",
    title: "[COPY-PLACEHOLDER] Find the moment that changed the game.",
    body: "[COPY-PLACEHOLDER] Move through the synchronized replay and inspect the position from either board.",
  },
  {
    image: "/placeholders/specimen-23-lichess-glyph-picker.png",
    imageAlt: "Learning-moment glyph picker preview",
    title: "[COPY-PLACEHOLDER] Turn decisions into learning moments.",
    body: "[COPY-PLACEHOLDER] Mark the move, test an alternative, and explain what the position taught you.",
  },
  {
    image: "/placeholders/specimen-12-eval-row.jpg",
    imageAlt: "Learning-moment review preview",
    title: "[COPY-PLACEHOLDER] Publish three moments to finish the quest.",
    body: "[COPY-PLACEHOLDER] Start the five-minute challenge when you are ready to choose a game.",
  },
] as const;

const registrationCopy = "[COPY-PLACEHOLDER] Publishing 3 learning moments grants account registration.";

export function LandingPage({ completed, onStart }: LandingPageProps) {
  const [slideIndex, setSlideIndex] = useState(0);
  const lastSlideIndex = slides.length - 1;
  const slide = slides[slideIndex];
  const selectSlide = (index: number) => setSlideIndex(Math.max(0, Math.min(lastSlideIndex, index)));

  const handleKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      selectSlide(slideIndex - 1);
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      selectSlide(slideIndex + 1);
    }
  };

  return (
    <section className="landing-page" aria-label="The Jimmy App landing">
      <header className="landing-topbar">
        <div className="landing-brand" aria-label="The Jimmy App">
          <span className="brand-mark" aria-hidden="true">J</span>
          <strong>The Jimmy App</strong>
        </div>
        <div className="landing-account-actions">
          <button type="button" aria-label="Log in" title={SIGN_IN_NOTICE} disabled>Log in</button>
          <button type="button" aria-label="Sign up" title={SIGN_IN_NOTICE} disabled={!completed}>Sign up</button>
        </div>
      </header>

      <div
        className="landing-carousel"
        role="region"
        aria-roledescription="carousel"
        aria-label="Product introduction"
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <article className="landing-slide" role="group" aria-roledescription="slide" aria-label={`${slideIndex + 1} of ${slides.length}`}>
          <div className="landing-slide-copy">
            <span data-copy-placeholder>[COPY-PLACEHOLDER] {slideIndex + 1} / {slides.length}</span>
            <h1 data-copy-placeholder>{slide.title}</h1>
            <p data-copy-placeholder>{slide.body}</p>
            <p data-copy-placeholder className="landing-registration-copy">{registrationCopy}</p>
            {slideIndex === lastSlideIndex && <button type="button" className="landing-start" aria-label="Start" onClick={onStart}>Start</button>}
          </div>
          <div className="landing-slide-image">
            <img src={slide.image} alt={slide.imageAlt} />
          </div>
        </article>

        <div className="landing-carousel-controls">
          <button type="button" aria-label="Previous slide" onClick={() => selectSlide(slideIndex - 1)} disabled={slideIndex === 0}>Prev</button>
          <div className="landing-carousel-dots" aria-label="Choose a slide">
            {slides.map((item, index) => (
              <button
                key={item.title}
                type="button"
                aria-label={`Go to slide ${index + 1}`}
                aria-current={index === slideIndex ? "true" : undefined}
                onClick={() => selectSlide(index)}
              />
            ))}
          </div>
          <button type="button" aria-label="Next slide" onClick={() => selectSlide(slideIndex + 1)} disabled={slideIndex === lastSlideIndex}>Next</button>
        </div>
      </div>
    </section>
  );
}
