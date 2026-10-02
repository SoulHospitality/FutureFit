import { Link } from 'react-router-dom';
import Reveal from './Reveal';

/** Eyebrow + editorial serif title (+ optional lede and "view all" link). */
export default function SectionHeading({
  eyebrow,
  title,
  titleEm,
  body,
  link,
  linkLabel = 'View all',
  align = 'start',
  tone = 'dark',
  className = '',
}) {
  const centered = align === 'center';
  const light = tone === 'light';

  return (
    <Reveal
      className={`flex flex-col gap-6 ${
        centered ? 'items-center text-center' : 'md:flex-row md:items-end md:justify-between'
      } ${className}`}
    >
      <div className={`max-w-2xl ${centered ? 'mx-auto' : ''}`}>
        {eyebrow ? (
          <p className={`ff-eyebrow ${light ? '!text-blush' : ''}`}>{eyebrow}</p>
        ) : null}
        <h2 className={`ff-title mt-4 ${light ? '!text-bone [&_em]:!text-blush' : ''}`}>
          {title}
          {titleEm ? (
            <>
              {' '}
              <em>{titleEm}</em>
            </>
          ) : null}
        </h2>
        {body ? (
          <p className={`ff-lede mt-4 max-w-xl ${centered ? 'mx-auto' : ''} ${light ? '!text-bone/70' : ''}`}>
            {body}
          </p>
        ) : null}
      </div>
      {link ? (
        <Link to={link} className={`ff-link shrink-0 ${light ? '!text-bone hover:!text-blush' : ''}`}>
          {linkLabel}
        </Link>
      ) : null}
    </Reveal>
  );
}
