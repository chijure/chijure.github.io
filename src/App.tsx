import { useEffect, useState } from 'react'
import { android, profile, research, sections, skills, software, strings, tools } from './data'
import type { Item, L, Lang } from './data'

const STORAGE_KEY = 'lang'
const YEAR = new Date().getFullYear()

const nav: { id: keyof typeof sections | 'perfil'; label: L }[] = [
  { id: 'android', label: { es: 'Android', en: 'Android' } },
  { id: 'tools', label: sections.tools.title },
  { id: 'research', label: { es: 'Investigación', en: 'Research' } },
  { id: 'software', label: { es: 'Software', en: 'Software' } },
  { id: 'perfil', label: strings.aboutTitle },
]

const languages: { code: Lang; short: string; name: string }[] = [
  { code: 'es', short: 'ES', name: 'Español' },
  { code: 'en', short: 'EN', name: 'English' },
]

function isLang(value: string | null): value is Lang {
  return value === 'es' || value === 'en'
}

function initialLang(): Lang {
  const fromUrl = new URLSearchParams(window.location.search).get('lang')
  if (isLang(fromUrl)) return fromUrl
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isLang(saved)) return saved
  } catch {
    // Storage can be blocked (private mode): fall back to the browser language.
  }
  return window.navigator.language?.toLowerCase().startsWith('es') ? 'es' : 'en'
}

function Card({ item, lang }: { item: Item; lang: Lang }) {
  return (
    <li className="card">
      <div className="card-head">
        <h3>{item.name}</h3>
        {item.status && <span className="status">{item.status[lang]}</span>}
      </div>
      <p>{item.summary[lang]}</p>
      <ul className="tags" aria-label={strings.tagsLabel[lang]}>
        {item.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <div className="links">
        {item.links.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
            {typeof link.label === 'string' ? link.label : link.label[lang]}
          </a>
        ))}
      </div>
    </li>
  )
}

function Section({
  id,
  items,
  lang,
}: {
  id: keyof typeof sections
  items: Item[]
  lang: Lang
}) {
  const section = sections[id]
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <header className="section-head">
        <h2 id={`${id}-title`}>{section.title[lang]}</h2>
        <p>{section.lead[lang]}</p>
      </header>
      <ul className="grid">
        {items.map((item) => (
          <Card key={item.name} item={item} lang={lang} />
        ))}
      </ul>
    </section>
  )
}

export default function App() {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    document.documentElement.lang = lang
    document.title = strings.title[lang]
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', strings.description[lang])
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // Not persisting is fine; the choice still applies to this visit.
    }
  }, [lang])

  return (
    <>
      <a className="skip" href="#contenido">{strings.skip[lang]}</a>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label={lang === 'es' ? 'Inicio' : 'Home'}>
          <span aria-hidden="true">&gt;_</span> {profile.handle}
        </a>
        <nav aria-label={strings.mainNav[lang]}>
          <ul>
            {nav.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`}>{entry.label[lang]}</a>
              </li>
            ))}
          </ul>
        </nav>
        <div className="lang" role="group" aria-label={strings.langLabel[lang]}>
          {languages.map((option) => (
            <button
              key={option.code}
              type="button"
              lang={option.code}
              aria-pressed={lang === option.code}
              aria-label={option.name}
              title={option.name}
              onClick={() => setLang(option.code)}
            >
              {option.short}
            </button>
          ))}
        </div>
      </header>

      <main id="contenido">
        <section id="inicio" className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">{strings.roles[lang]}</p>
          <h1 id="hero-title">{profile.name}</h1>
          <p className="intro">{strings.intro[lang]}</p>
          <div className="cta">
            <a className="btn primary" href={profile.github} target="_blank" rel="noopener noreferrer">
              {strings.ctaGithub[lang]}
            </a>
            <a className="btn" href={profile.org} target="_blank" rel="noopener noreferrer">
              {strings.ctaAndroid[lang]}
            </a>
          </div>
        </section>

        <Section id="android" items={android} lang={lang} />
        <Section id="tools" items={tools} lang={lang} />
        <Section id="research" items={research} lang={lang} />
        <Section id="software" items={software} lang={lang} />

        <section id="perfil" aria-labelledby="perfil-title" className="about">
          <header className="section-head">
            <h2 id="perfil-title">{strings.aboutTitle[lang]}</h2>
          </header>
          <div className="about-body">
            <p>{strings.aboutText[lang]}</p>
            <h3>{strings.skillsTitle[lang]}</h3>
            <ul className="chips" aria-label={strings.skillsLabel[lang]}>
              {skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer>
        <p>
          © {YEAR} {profile.name} ·{' '}
          <a href={profile.github} target="_blank" rel="noopener noreferrer">github.com/{profile.handle}</a>
        </p>
      </footer>
    </>
  )
}
