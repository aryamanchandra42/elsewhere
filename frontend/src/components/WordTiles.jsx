import { motion } from 'framer-motion';

const SIZES = {
  xs: { tile: 24, gap: 3, font: '0.72rem' },
  sm: { tile: 30, gap: 4, font: '0.9rem' },
  md: { tile: 38, gap: 5, font: '1.15rem' },
  lg: { tile: 44, gap: 6, font: '1.35rem' },
};

function tierClass(tier) {
  if (tier === 'good') return 'tile-good';
  if (tier === 'mid') return 'tile-mid';
  if (tier === 'bad') return 'tile-bad';
  return '';
}

export default function WordTiles({
  word = '',
  tier = null,
  size = 'md',
  minSlots = 0,
  maxSlots = 12,
  animateReveal = false,
  placeholder = false,
}) {
  const s = SIZES[size] || SIZES.md;
  const letters = String(word || '').toUpperCase().split('');
  const slotCount = Math.min(
    maxSlots,
    Math.max(minSlots, letters.length || (placeholder ? minSlots : 0)),
  );

  return (
    <div className="word-tile-row" style={{ gap: s.gap }}>
      {Array.from({ length: slotCount }, (_, index) => {
        const letter = letters[index] || '';
        const isEmpty = !letter;
        const cls = [
          'word-tile',
          isEmpty && !tier ? 'tile-empty' : tierClass(tier) || (isEmpty ? 'tile-empty' : 'tile-filled'),
          placeholder && isEmpty ? 'tile-placeholder' : '',
        ].filter(Boolean).join(' ');

        const Tile = animateReveal && letter ? motion.div : 'div';
        const motionProps = animateReveal && letter
          ? {
              initial: { rotateX: -90, opacity: 0.4 },
              animate: { rotateX: 0, opacity: 1 },
              transition: { delay: index * 0.06, duration: 0.32, ease: [0.22, 1, 0.36, 1] },
            }
          : {};

        return (
          <Tile
            key={`${word}-${index}`}
            className={cls}
            style={{ width: s.tile, height: s.tile, fontSize: s.font }}
            {...motionProps}
          >
            {letter}
          </Tile>
        );
      })}
    </div>
  );
}

export function WordInputTiles({
  value = '',
  onChange,
  inputRef,
  placeholder = 'TYPE',
  maxLength = 24,
  size = 'lg',
  id,
  disabled = false,
}) {
  const s = SIZES[size] || SIZES.lg;
  const letters = String(value || '').toUpperCase().split('');
  const slotCount = Math.max(5, Math.min(maxLength, Math.max(letters.length + 1, 5)));

  return (
    <label className="word-input-tiles" htmlFor={id}>
      <input
        id={id}
        ref={inputRef}
        type="text"
        autoComplete="off"
        inputMode="text"
        enterKeyHint="done"
        maxLength={maxLength}
        value={value}
        disabled={disabled}
        onChange={onChange}
        className="word-input-tiles-hidden"
      />
      <div className="word-tile-row" style={{ gap: s.gap }}>
        {Array.from({ length: slotCount }, (_, index) => {
          const letter = letters[index] || '';
          const isActive = index === letters.length && !disabled;
          return (
            <div
              key={index}
              className={[
                'word-tile',
                letter ? 'tile-filled tile-active-input' : 'tile-empty',
                isActive ? 'tile-cursor' : '',
              ].filter(Boolean).join(' ')}
              style={{ width: s.tile, height: s.tile, fontSize: s.font }}
            >
              {letter}
            </div>
          );
        })}
      </div>
      {!value && (
        <span className="word-input-hint">{placeholder}</span>
      )}
    </label>
  );
}

export function WordPairDemo({ from, to, tier = 'good', size = 'sm' }) {
  return (
    <div className="word-pair-demo">
      <WordTiles word={from} size={size} minSlots={from.length} animateReveal={false} />
      <span className="word-pair-arrow" aria-hidden>→</span>
      <WordTiles word={to} tier={tier} size={size} minSlots={to.length} animateReveal />
    </div>
  );
}
