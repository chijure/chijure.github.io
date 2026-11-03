import { android, profile, research, skills, software, tools } from './data'
import type { Item } from './data'

const nav = [
  { id: 'android', label: 'Android' },
  { id: 'herramientas', label: 'Herramientas' },
  { id: 'investigacion', label: 'Investigación' },
  { id: 'software', label: 'Software' },
  { id: 'perfil', label: 'Perfil' },
]

function Card({ item }: { item: Item }) {
  return (
    <li className="card">
      <div className="card-head">
        <h3>{item.name}</h3>
        {item.status && <span className="status">{item.status}</span>}
      </div>
      <p>{item.summary}</p>
      <ul className="tags" aria-label="Tecnologías">
        {item.tags.map((tag) => (
          <li key={tag}>{tag}</li>
        ))}
      </ul>
      <div className="links">
        {item.links.map((link) => (
          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer">
            {link.label}
          </a>
        ))}
      </div>
    </li>
  )
}

function Section({ id, title, lead, items }: { id: string; title: string; lead: string; items: Item[] }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`}>
      <header className="section-head">
        <h2 id={`${id}-title`}>{title}</h2>
        <p>{lead}</p>
      </header>
      <ul className="grid">
        {items.map((item) => (
          <Card key={item.name} item={item} />
        ))}
      </ul>
    </section>
  )
}

export default function App() {
  return (
    <>
      <a className="skip" href="#contenido">Saltar al contenido</a>
      <header className="topbar">
        <a className="brand" href="#inicio" aria-label="Inicio">
          <span aria-hidden="true">&gt;_</span> {profile.handle}
        </a>
        <nav aria-label="Principal">
          <ul>
            {nav.map((entry) => (
              <li key={entry.id}>
                <a href={`#${entry.id}`}>{entry.label}</a>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenido">
        <section id="inicio" className="hero" aria-labelledby="hero-title">
          <p className="eyebrow">{profile.roles.join(' · ')}</p>
          <h1 id="hero-title">{profile.name}</h1>
          <p className="intro">{profile.intro}</p>
          <div className="cta">
            <a className="btn primary" href={profile.github} target="_blank" rel="noopener noreferrer">
              GitHub
            </a>
            <a className="btn" href={profile.org} target="_blank" rel="noopener noreferrer">
              Proyectos Android
            </a>
            <a className="btn" href={profile.web} target="_blank" rel="noopener noreferrer">
              Sitio personal
            </a>
          </div>
        </section>

        <Section
          id="android"
          title="Ports de Android"
          lead="Equipos que ya nadie actualiza, de nuevo en marcha: ROMs, recoveries y kernels construidos desde el código fuente."
          items={android}
        />
        <Section
          id="herramientas"
          title="Herramientas"
          lead="Lo que fui necesitando para probar, documentar y publicar mejor ese trabajo."
          items={tools}
        />
        <Section
          id="investigacion"
          title="Hardware e investigación"
          lead="Bootloaders, recuperación de equipos y arreglos de hardware, probados siempre en el equipo real."
          items={research}
        />
        <Section
          id="software"
          title="Desarrollo de software"
          lead="Aplicaciones móviles y web, además de plugins para la comunidad."
          items={software}
        />

        <section id="perfil" aria-labelledby="perfil-title" className="about">
          <header className="section-head">
            <h2 id="perfil-title">Perfil</h2>
          </header>
          <div className="about-body">
            <p>
              Trabajo como arquitecto de software y también enseño, administro y participo como catequista.
              Me gusta explicar lo que construyo: cada port que publico lleva su estado real, las
              pruebas hechas y lo que todavía no funciona.
            </p>
            <h3>Tecnologías</h3>
            <ul className="chips" aria-label="Tecnologías que uso">
              {skills.map((skill) => (
                <li key={skill}>{skill}</li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <footer>
        <p>
          © {new Date().getFullYear()} {profile.name} ·{' '}
          <a href={profile.github} target="_blank" rel="noopener noreferrer">github.com/{profile.handle}</a>
        </p>
      </footer>
    </>
  )
}
