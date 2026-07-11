import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  BadgeCheck,
  Banknote,
  Bell,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronRight,
  CircleCheckBig,
  Clock3,
  Coins,
  Home,
  ListTodo,
  LockKeyhole,
  Medal,
  Pencil,
  Plus,
  RotateCcw,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import './App.css'

type Rolle = 'administrator' | 'barn'
type Status = 'venter' | 'godkjent' | 'avvist' | 'betalt'
type Fane = 'hjem' | 'oppdrag' | 'pokaler' | 'familie'

type Medlem = {
  id: string
  navn: string
  rolle: Rolle
  emoji: string
  profilfarge: string
}

type Oppgave = {
  id: string
  tittel: string
  beskrivelse: string
  belop: number
  emoji: string
  aktiv: boolean
}

type Innsending = {
  id: string
  oppgaveId: string
  barnId: string
  status: Status
  sendtInn: string
  godkjentAv?: string
}

type Familieinnstillinger = {
  familienavn: string
  slagord: string
  utbetalingsdag: string
  utbetalingstid: string
}

type Appdata = {
  medlemmer: Medlem[]
  oppgaver: Oppgave[]
  innsendinger: Innsending[]
  innstillinger: Familieinnstillinger
}

type Oppgaveskjema = {
  id?: string
  tittel: string
  beskrivelse: string
  belop: string
  emoji: string
}

const LAGRINGSNOKKEL = 'oppdragsklubben-demo-v1'
const PROFILFARGER = ['#12AEB4', '#FB7B22', '#7CBD69', '#71458D', '#FFCD00', '#BD2B4F']
const AVATARER = ['🦊', '🐙', '🐼', '🦁', '🐬', '🦄', '🚀', '🎨', '⚽', '🎧', '🌟', '🛹']
const OPPGAVEEMOJIER = ['🍽️', '🧹', '🗑️', '🧺', '🪜', '🛏️', '🧽', '🐕', '🌱', '📦', '✨', '🚲']
const UKEDAGER = ['Mandag', 'Tirsdag', 'Onsdag', 'Torsdag', 'Fredag', 'Lørdag', 'Søndag']

const startdata: Appdata = {
  medlemmer: [
    { id: 'rune', navn: 'Rune', rolle: 'administrator', emoji: '🚀', profilfarge: '#14406B' },
    { id: 'mamma', navn: 'Mamma', rolle: 'administrator', emoji: '🎨', profilfarge: '#71458D' },
    { id: 'barn-1', navn: 'Barn 1', rolle: 'barn', emoji: '🦊', profilfarge: '#FB7B22' },
    { id: 'barn-2', navn: 'Barn 2', rolle: 'barn', emoji: '🐙', profilfarge: '#12AEB4' },
  ],
  oppgaver: [
    {
      id: 'oppvaskmaskin',
      tittel: 'Tømme oppvaskmaskinen',
      beskrivelse: 'Sett alt på riktig plass og tørk av benken.',
      belop: 15,
      emoji: '🍽️',
      aktiv: true,
    },
    {
      id: 'trapp',
      tittel: 'Vaske trappen',
      beskrivelse: 'Støvsug først, og vask deretter alle trinnene.',
      belop: 35,
      emoji: '🪜',
      aktiv: true,
    },
    {
      id: 'soppel',
      tittel: 'Ta ut søppelet',
      beskrivelse: 'Husk ny pose i bøtta etterpå.',
      belop: 10,
      emoji: '🗑️',
      aktiv: true,
    },
    {
      id: 'stue',
      tittel: 'Rydde stua',
      beskrivelse: 'Legg ting på plass og puff putene.',
      belop: 20,
      emoji: '✨',
      aktiv: true,
    },
    {
      id: 'stovsuge',
      tittel: 'Støvsuge første etasje',
      beskrivelse: 'Ta kjøkken, stue og gang.',
      belop: 30,
      emoji: '🧹',
      aktiv: true,
    },
    {
      id: 'klaer',
      tittel: 'Brette klær',
      beskrivelse: 'Brett en full kurv og fordel klærne.',
      belop: 20,
      emoji: '🧺',
      aktiv: true,
    },
  ],
  innsendinger: [
    {
      id: 'demo-1',
      oppgaveId: 'trapp',
      barnId: 'barn-1',
      status: 'godkjent',
      sendtInn: '2026-07-08T17:12:00.000Z',
      godkjentAv: 'rune',
    },
    {
      id: 'demo-2',
      oppgaveId: 'klaer',
      barnId: 'barn-1',
      status: 'godkjent',
      sendtInn: '2026-07-09T18:45:00.000Z',
      godkjentAv: 'mamma',
    },
    {
      id: 'demo-3',
      oppgaveId: 'oppvaskmaskin',
      barnId: 'barn-1',
      status: 'venter',
      sendtInn: '2026-07-10T18:02:00.000Z',
    },
    {
      id: 'demo-4',
      oppgaveId: 'soppel',
      barnId: 'barn-2',
      status: 'godkjent',
      sendtInn: '2026-07-08T19:30:00.000Z',
      godkjentAv: 'rune',
    },
    {
      id: 'demo-5',
      oppgaveId: 'stovsuge',
      barnId: 'barn-2',
      status: 'godkjent',
      sendtInn: '2026-07-09T16:10:00.000Z',
      godkjentAv: 'mamma',
    },
    {
      id: 'demo-6',
      oppgaveId: 'stue',
      barnId: 'barn-2',
      status: 'venter',
      sendtInn: '2026-07-10T18:20:00.000Z',
    },
  ],
  innstillinger: {
    familienavn: 'Oppdragsklubben',
    slagord: 'Små oppdrag. Stor mestring.',
    utbetalingsdag: 'Søndag',
    utbetalingstid: '18:00',
  },
}

const tomtOppgaveskjema: Oppgaveskjema = {
  tittel: '',
  beskrivelse: '',
  belop: '15',
  emoji: '✨',
}

function hentLagredeData(): Appdata {
  try {
    const lagret = window.localStorage.getItem(LAGRINGSNOKKEL)
    return lagret ? (JSON.parse(lagret) as Appdata) : startdata
  } catch {
    return startdata
  }
}

function formaterBelop(belop: number): string {
  return new Intl.NumberFormat('nb-NO', {
    style: 'currency',
    currency: 'NOK',
    maximumFractionDigits: 0,
  }).format(belop)
}

function formaterTidspunkt(isoDato: string): string {
  return new Intl.DateTimeFormat('nb-NO', {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(isoDato))
}

function lagId(prefiks: string): string {
  return `${prefiks}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function App() {
  const [data, setData] = useState<Appdata>(hentLagredeData)
  const [aktivMedlemId, setAktivMedlemId] = useState('rune')
  const [aktivFane, setAktivFane] = useState<Fane>('hjem')
  const [profilvelgerApen, setProfilvelgerApen] = useState(false)
  const [oppgavemodalApen, setOppgavemodalApen] = useState(false)
  const [oppgaveskjema, setOppgaveskjema] = useState<Oppgaveskjema>(tomtOppgaveskjema)
  const [varseltekst, setVarseltekst] = useState('')
  const [feiring, setFeiring] = useState(false)
  const [redigerFamilie, setRedigerFamilie] = useState(false)

  useEffect(() => {
    window.localStorage.setItem(LAGRINGSNOKKEL, JSON.stringify(data))
  }, [data])

  useEffect(() => {
    if (!varseltekst) return
    const tidsur = window.setTimeout(() => setVarseltekst(''), 3200)
    return () => window.clearTimeout(tidsur)
  }, [varseltekst])

  useEffect(() => {
    if (!feiring) return
    const tidsur = window.setTimeout(() => setFeiring(false), 1800)
    return () => window.clearTimeout(tidsur)
  }, [feiring])

  const aktivMedlem = useMemo(
    () => data.medlemmer.find((medlem) => medlem.id === aktivMedlemId) ?? data.medlemmer[0],
    [aktivMedlemId, data.medlemmer],
  )

  const erAdministrator = aktivMedlem.rolle === 'administrator'
  const barn = useMemo(() => data.medlemmer.filter((medlem) => medlem.rolle === 'barn'), [data.medlemmer])
  const administratorer = useMemo(
    () => data.medlemmer.filter((medlem) => medlem.rolle === 'administrator'),
    [data.medlemmer],
  )

  const ventendeInnsendinger = useMemo(
    () => data.innsendinger.filter((innsending) => innsending.status === 'venter'),
    [data.innsendinger],
  )

  const godkjentTotal = useMemo(
    () =>
      data.innsendinger
        .filter((innsending) => innsending.status === 'godkjent')
        .reduce((sum, innsending) => {
          const oppgave = data.oppgaver.find((element) => element.id === innsending.oppgaveId)
          return sum + (oppgave?.belop ?? 0)
        }, 0),
    [data.innsendinger, data.oppgaver],
  )

  const aktiveOppgaver = useMemo(() => data.oppgaver.filter((oppgave) => oppgave.aktiv), [data.oppgaver])

  const visVarsel = (tekst: string) => setVarseltekst(tekst)

  const byttProfil = (medlemId: string) => {
    setAktivMedlemId(medlemId)
    setAktivFane('hjem')
    setProfilvelgerApen(false)
  }

  const finnOppgave = (oppgaveId: string) => data.oppgaver.find((oppgave) => oppgave.id === oppgaveId)
  const finnMedlem = (medlemId: string) => data.medlemmer.find((medlem) => medlem.id === medlemId)

  const sendInnOppgave = (oppgaveId: string) => {
    const eksisterer = data.innsendinger.some(
      (innsending) =>
        innsending.barnId === aktivMedlem.id &&
        innsending.oppgaveId === oppgaveId &&
        innsending.status === 'venter',
    )

    if (eksisterer) {
      visVarsel('Denne oppgaven venter allerede på godkjenning.')
      return
    }

    const nyInnsending: Innsending = {
      id: lagId('innsending'),
      oppgaveId,
      barnId: aktivMedlem.id,
      status: 'venter',
      sendtInn: new Date().toISOString(),
    }

    setData((gammelData) => ({
      ...gammelData,
      innsendinger: [nyInnsending, ...gammelData.innsendinger],
    }))
    setFeiring(true)
    visVarsel('Oppdraget er sendt til de voksne!')
  }

  const behandleInnsending = (innsendingId: string, nyStatus: 'godkjent' | 'avvist') => {
    setData((gammelData) => ({
      ...gammelData,
      innsendinger: gammelData.innsendinger.map((innsending) =>
        innsending.id === innsendingId
          ? { ...innsending, status: nyStatus, godkjentAv: aktivMedlem.id }
          : innsending,
      ),
    }))
    visVarsel(nyStatus === 'godkjent' ? 'Oppdraget er godkjent.' : 'Oppdraget ble sendt tilbake.')
  }

  const markerSomBetalt = () => {
    if (godkjentTotal === 0) {
      visVarsel('Det er ingen godkjente beløp å betale akkurat nå.')
      return
    }

    setData((gammelData) => ({
      ...gammelData,
      innsendinger: gammelData.innsendinger.map((innsending) =>
        innsending.status === 'godkjent' ? { ...innsending, status: 'betalt' } : innsending,
      ),
    }))
    setFeiring(true)
    visVarsel('Ukens utbetaling er registrert som betalt!')
  }

  const apneNyOppgave = () => {
    setOppgaveskjema(tomtOppgaveskjema)
    setOppgavemodalApen(true)
  }

  const apneRedigering = (oppgave: Oppgave) => {
    setOppgaveskjema({
      id: oppgave.id,
      tittel: oppgave.tittel,
      beskrivelse: oppgave.beskrivelse,
      belop: String(oppgave.belop),
      emoji: oppgave.emoji,
    })
    setOppgavemodalApen(true)
  }

  const lagreOppgave = (hendelse: FormEvent<HTMLFormElement>) => {
    hendelse.preventDefault()
    const belop = Number(oppgaveskjema.belop)

    if (!oppgaveskjema.tittel.trim() || !Number.isFinite(belop) || belop < 0) {
      visVarsel('Skriv inn et navn og et gyldig beløp.')
      return
    }

    setData((gammelData) => {
      if (oppgaveskjema.id) {
        return {
          ...gammelData,
          oppgaver: gammelData.oppgaver.map((oppgave) =>
            oppgave.id === oppgaveskjema.id
              ? {
                  ...oppgave,
                  tittel: oppgaveskjema.tittel.trim(),
                  beskrivelse: oppgaveskjema.beskrivelse.trim(),
                  belop,
                  emoji: oppgaveskjema.emoji,
                }
              : oppgave,
          ),
        }
      }

      const nyOppgave: Oppgave = {
        id: lagId('oppgave'),
        tittel: oppgaveskjema.tittel.trim(),
        beskrivelse: oppgaveskjema.beskrivelse.trim(),
        belop,
        emoji: oppgaveskjema.emoji,
        aktiv: true,
      }

      return { ...gammelData, oppgaver: [...gammelData.oppgaver, nyOppgave] }
    })

    setOppgavemodalApen(false)
    setOppgaveskjema(tomtOppgaveskjema)
    visVarsel(oppgaveskjema.id ? 'Oppgaven er oppdatert.' : 'Ny oppgave er lagt til.')
  }

  const slettOppgave = (oppgaveId: string) => {
    const erIHistorikk = data.innsendinger.some((innsending) => innsending.oppgaveId === oppgaveId)

    setData((gammelData) => ({
      ...gammelData,
      oppgaver: erIHistorikk
        ? gammelData.oppgaver.map((oppgave) =>
            oppgave.id === oppgaveId ? { ...oppgave, aktiv: false } : oppgave,
          )
        : gammelData.oppgaver.filter((oppgave) => oppgave.id !== oppgaveId),
    }))
    visVarsel(erIHistorikk ? 'Oppgaven er arkivert fordi den har historikk.' : 'Oppgaven er slettet.')
  }

  const oppdaterMedlem = (medlemId: string, felt: keyof Pick<Medlem, 'navn' | 'emoji' | 'profilfarge'>, verdi: string) => {
    setData((gammelData) => ({
      ...gammelData,
      medlemmer: gammelData.medlemmer.map((medlem) =>
        medlem.id === medlemId ? { ...medlem, [felt]: verdi } : medlem,
      ),
    }))
  }

  const leggTilBarn = () => {
    const antallBarn = data.medlemmer.filter((medlem) => medlem.rolle === 'barn').length
    const nyttBarn: Medlem = {
      id: lagId('barn'),
      navn: `Barn ${antallBarn + 1}`,
      rolle: 'barn',
      emoji: AVATARER[antallBarn % AVATARER.length],
      profilfarge: PROFILFARGER[antallBarn % PROFILFARGER.length],
    }
    setData((gammelData) => ({ ...gammelData, medlemmer: [...gammelData.medlemmer, nyttBarn] }))
    visVarsel('Et nytt barn er lagt til familien.')
  }

  const aktiverVarsler = async () => {
    if (!('Notification' in window)) {
      visVarsel('Denne nettleseren støtter ikke varsler.')
      return
    }

    try {
      const tillatelse = await Notification.requestPermission()
      if (tillatelse !== 'granted') {
        visVarsel('Varsler ble ikke tillatt på denne enheten.')
        return
      }

      const registrering = await navigator.serviceWorker.ready
      await registrering.showNotification(`${data.innstillinger.familienavn}: Varsler er på`, {
        body: `Dere blir minnet på utbetaling ${data.innstillinger.utbetalingsdag.toLowerCase()} kl. ${data.innstillinger.utbetalingstid}.`,
        icon: '/app-icon-192.png',
        badge: '/app-icon-192.png',
      })
      visVarsel('Testvarsel sendt. Automatisk ukevarsel kobles til databasen senere.')
    } catch {
      visVarsel('Testvarselet kunne ikke sendes på denne enheten.')
    }
  }

  const nullstillDemo = () => {
    setData(startdata)
    setAktivMedlemId('rune')
    setAktivFane('hjem')
    visVarsel('Demoen er nullstilt.')
  }

  const barnesaldo = (barnId: string, statuser: Status[] = ['godkjent']) =>
    data.innsendinger
      .filter((innsending) => innsending.barnId === barnId && statuser.includes(innsending.status))
      .reduce((sum, innsending) => sum + (finnOppgave(innsending.oppgaveId)?.belop ?? 0), 0)

  const barnetsInnsendinger = data.innsendinger.filter((innsending) => innsending.barnId === aktivMedlem.id)
  const barnetsOpptjening = barnesaldo(aktivMedlem.id, ['godkjent'])
  const barnetsAntallFullfort = barnetsInnsendinger.filter((innsending) =>
    ['godkjent', 'betalt'].includes(innsending.status),
  ).length
  const barnetsRekke = Math.min(7, Math.max(1, barnetsAntallFullfort))

  return (
    <div className="appskall">
      {feiring && <Feiring />}

      <header className="topplinje">
        <button className="merke" type="button" onClick={() => setAktivFane('hjem')} aria-label="Gå til hjem">
          <span className="merkeikon"><Sparkles size={20} /></span>
          <span>
            <strong>{data.innstillinger.familienavn}</strong>
            <small>{data.innstillinger.slagord}</small>
          </span>
        </button>

        <button className="profilknapp" type="button" onClick={() => setProfilvelgerApen(true)}>
          <span className="profilavatar" style={{ backgroundColor: aktivMedlem.profilfarge }}>
            {aktivMedlem.emoji}
          </span>
          <span className="profiltekst">
            <strong>{aktivMedlem.navn}</strong>
            <small>{erAdministrator ? 'Voksen' : 'Barn'}</small>
          </span>
          <ChevronDown size={17} />
        </button>
      </header>

      <main className="hovedinnhold">
        {aktivFane === 'hjem' &&
          (erAdministrator ? (
            <Administratorhjem
              aktivMedlem={aktivMedlem}
              barn={barn}
              godkjentTotal={godkjentTotal}
              ventendeInnsendinger={ventendeInnsendinger}
              innstillinger={data.innstillinger}
              finnOppgave={finnOppgave}
              finnMedlem={finnMedlem}
              barnesaldo={barnesaldo}
              behandleInnsending={behandleInnsending}
              markerSomBetalt={markerSomBetalt}
              settAktivFane={setAktivFane}
            />
          ) : (
            <Barnehjem
              medlem={aktivMedlem}
              oppgaver={aktiveOppgaver}
              innsendinger={barnetsInnsendinger}
              opptjening={barnetsOpptjening}
              antallFullfort={barnetsAntallFullfort}
              rekke={barnetsRekke}
              sendInnOppgave={sendInnOppgave}
              settAktivFane={setAktivFane}
            />
          ))}

        {aktivFane === 'oppdrag' &&
          (erAdministrator ? (
            <AdministrerOppgaver
              oppgaver={data.oppgaver}
              apneNyOppgave={apneNyOppgave}
              apneRedigering={apneRedigering}
              slettOppgave={slettOppgave}
            />
          ) : (
            <BarnetsOppgaver
              oppgaver={aktiveOppgaver}
              innsendinger={barnetsInnsendinger}
              sendInnOppgave={sendInnOppgave}
            />
          ))}

        {aktivFane === 'pokaler' && (
          <Pokaler
            medlem={aktivMedlem}
            erAdministrator={erAdministrator}
            barn={barn}
            data={data}
            finnOppgave={finnOppgave}
            barnesaldo={barnesaldo}
            antallFullfort={barnetsAntallFullfort}
            rekke={barnetsRekke}
          />
        )}

        {aktivFane === 'familie' && (
          <Familie
            data={data}
            erAdministrator={erAdministrator}
            redigerFamilie={redigerFamilie}
            settRedigerFamilie={setRedigerFamilie}
            settData={setData}
            oppdaterMedlem={oppdaterMedlem}
            leggTilBarn={leggTilBarn}
            aktiverVarsler={aktiverVarsler}
            nullstillDemo={nullstillDemo}
          />
        )}
      </main>

      <nav className="bunnmeny" aria-label="Hovedmeny">
        <Menyknapp aktiv={aktivFane === 'hjem'} etikett="Hjem" onClick={() => setAktivFane('hjem')}>
          <Home size={22} />
        </Menyknapp>
        <Menyknapp aktiv={aktivFane === 'oppdrag'} etikett="Oppdrag" onClick={() => setAktivFane('oppdrag')}>
          <ListTodo size={22} />
        </Menyknapp>
        <Menyknapp aktiv={aktivFane === 'pokaler'} etikett="Pokaler" onClick={() => setAktivFane('pokaler')}>
          <Trophy size={22} />
        </Menyknapp>
        <Menyknapp aktiv={aktivFane === 'familie'} etikett="Familie" onClick={() => setAktivFane('familie')}>
          {erAdministrator ? <Settings size={22} /> : <Users size={22} />}
        </Menyknapp>
      </nav>

      {profilvelgerApen && (
        <Modal onClose={() => setProfilvelgerApen(false)} tittel="Hvem bruker appen?">
          <p className="modalintro">
            I denne prototypen bytter vi profil her. I den ferdige appen får hver person sin egen private innlogging.
          </p>
          <div className="profilliste">
            {administratorer.length > 0 && <span className="seksjonsetikett">Voksne</span>}
            {administratorer.map((medlem) => (
              <Profilrad key={medlem.id} medlem={medlem} aktiv={medlem.id === aktivMedlem.id} onClick={byttProfil} />
            ))}
            {barn.length > 0 && <span className="seksjonsetikett">Barn</span>}
            {barn.map((medlem) => (
              <Profilrad key={medlem.id} medlem={medlem} aktiv={medlem.id === aktivMedlem.id} onClick={byttProfil} />
            ))}
          </div>
        </Modal>
      )}

      {oppgavemodalApen && (
        <Modal
          onClose={() => setOppgavemodalApen(false)}
          tittel={oppgaveskjema.id ? 'Rediger oppgave' : 'Lag ny oppgave'}
        >
          <form className="skjema" onSubmit={lagreOppgave}>
            <label>
              Oppgavenavn
              <input
                autoFocus
                value={oppgaveskjema.tittel}
                onChange={(hendelse) => setOppgaveskjema({ ...oppgaveskjema, tittel: hendelse.target.value })}
                placeholder="For eksempel: Lufte hunden"
              />
            </label>
            <label>
              Kort forklaring
              <textarea
                rows={3}
                value={oppgaveskjema.beskrivelse}
                onChange={(hendelse) => setOppgaveskjema({ ...oppgaveskjema, beskrivelse: hendelse.target.value })}
                placeholder="Hva må gjøres for at oppgaven er ferdig?"
              />
            </label>
            <div className="skjemarad">
              <label>
                Beløp i kroner
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="1"
                  value={oppgaveskjema.belop}
                  onChange={(hendelse) => setOppgaveskjema({ ...oppgaveskjema, belop: hendelse.target.value })}
                />
              </label>
              <label>
                Symbol
                <select
                  value={oppgaveskjema.emoji}
                  onChange={(hendelse) => setOppgaveskjema({ ...oppgaveskjema, emoji: hendelse.target.value })}
                >
                  {OPPGAVEEMOJIER.map((emoji) => (
                    <option key={emoji} value={emoji}>{emoji}</option>
                  ))}
                </select>
              </label>
            </div>
            <button className="hovedknapp fullbredde" type="submit">
              <Check size={18} /> Lagre oppgave
            </button>
          </form>
        </Modal>
      )}

      {varseltekst && <div className="toast"><CircleCheckBig size={19} /> {varseltekst}</div>}
    </div>
  )
}

type AdministratorhjemProps = {
  aktivMedlem: Medlem
  barn: Medlem[]
  godkjentTotal: number
  ventendeInnsendinger: Innsending[]
  innstillinger: Familieinnstillinger
  finnOppgave: (oppgaveId: string) => Oppgave | undefined
  finnMedlem: (medlemId: string) => Medlem | undefined
  barnesaldo: (barnId: string, statuser?: Status[]) => number
  behandleInnsending: (innsendingId: string, nyStatus: 'godkjent' | 'avvist') => void
  markerSomBetalt: () => void
  settAktivFane: (fane: Fane) => void
}

function Administratorhjem({
  aktivMedlem,
  barn,
  godkjentTotal,
  ventendeInnsendinger,
  innstillinger,
  finnOppgave,
  finnMedlem,
  barnesaldo,
  behandleInnsending,
  markerSomBetalt,
  settAktivFane,
}: AdministratorhjemProps) {
  return (
    <>
      <section className="velkomst">
        <div>
          <span className="oyebryn">Foreldreoversikt</span>
          <h1>God kveld, {aktivMedlem.navn}.</h1>
          <p>Her ser dere hva som er gjort, hva som må sjekkes og hva familien skylder denne uken.</p>
        </div>
        <div className="sikkerhetsmerke"><ShieldCheck size={18} /> Kun familien</div>
      </section>

      <section className="utbetalingskort">
        <div className="utbetalingsglimt"><Sparkles size={18} /></div>
        <div>
          <span className="kortetikett">Klar til utbetaling</span>
          <strong className="storbelop">{formaterBelop(godkjentTotal)}</strong>
          <span className="utbetalingsdato">
            <CalendarDays size={16} /> {innstillinger.utbetalingsdag} kl. {innstillinger.utbetalingstid}
          </span>
        </div>
        <button className="lysknapp" type="button" onClick={markerSomBetalt}>
          <Banknote size={18} /> Marker som betalt
        </button>
      </section>

      <div className="oversiktsrutenett">
        {barn.map((medlem) => (
          <article className="saldokort" key={medlem.id}>
            <div className="korttopplinje">
              <span className="miniavatar" style={{ backgroundColor: medlem.profilfarge }}>{medlem.emoji}</span>
              <div>
                <strong>{medlem.navn}</strong>
                <small>Denne uken</small>
              </div>
            </div>
            <strong className="saldobelop">{formaterBelop(barnesaldo(medlem.id))}</strong>
            <div className="statuslinje">
              <span><CircleCheckBig size={15} /> Godkjent</span>
              <span>{barnesaldo(medlem.id, ['venter']) > 0 ? `${formaterBelop(barnesaldo(medlem.id, ['venter']))} til sjekk` : 'Alt sjekket'}</span>
            </div>
          </article>
        ))}
      </div>

      <section className="seksjon">
        <div className="seksjonstopp">
          <div>
            <span className="oyebryn">Trenger deres blikk</span>
            <h2>Oppdrag til godkjenning</h2>
          </div>
          <span className="teller">{ventendeInnsendinger.length}</span>
        </div>

        {ventendeInnsendinger.length === 0 ? (
          <Tomtilstand
            ikon={<BadgeCheck size={28} />}
            tittel="Alt er kontrollert"
            tekst="Nye innsendte oppdrag dukker opp her."
          />
        ) : (
          <div className="godkjenningsliste">
            {ventendeInnsendinger.map((innsending) => {
              const oppgave = finnOppgave(innsending.oppgaveId)
              const medlem = finnMedlem(innsending.barnId)
              if (!oppgave || !medlem) return null

              return (
                <article className="godkjenningskort" key={innsending.id}>
                  <div className="oppgaveemoji">{oppgave.emoji}</div>
                  <div className="godkjenningsinfo">
                    <strong>{oppgave.tittel}</strong>
                    <span>{medlem.emoji} {medlem.navn} · {formaterTidspunkt(innsending.sendtInn)}</span>
                  </div>
                  <strong className="belopbrikke">+{oppgave.belop} kr</strong>
                  <div className="handlingsknapper">
                    <button
                      className="avslaknapp"
                      type="button"
                      onClick={() => behandleInnsending(innsending.id, 'avvist')}
                      aria-label={`Avvis ${oppgave.tittel}`}
                    >
                      <X size={20} />
                    </button>
                    <button
                      className="godkjennknapp"
                      type="button"
                      onClick={() => behandleInnsending(innsending.id, 'godkjent')}
                    >
                      <Check size={19} /> Godkjenn
                    </button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </section>

      <button className="snarveikort" type="button" onClick={() => settAktivFane('oppdrag')}>
        <span className="snarveiikon"><ListTodo size={22} /></span>
        <span>
          <strong>Rediger oppgaver og beløp</strong>
          <small>Legg til, endre eller arkiver familiens oppdrag.</small>
        </span>
        <ChevronRight size={20} />
      </button>
    </>
  )
}

type BarnehjemProps = {
  medlem: Medlem
  oppgaver: Oppgave[]
  innsendinger: Innsending[]
  opptjening: number
  antallFullfort: number
  rekke: number
  sendInnOppgave: (oppgaveId: string) => void
  settAktivFane: (fane: Fane) => void
}

function Barnehjem({
  medlem,
  oppgaver,
  innsendinger,
  opptjening,
  antallFullfort,
  rekke,
  sendInnOppgave,
  settAktivFane,
}: BarnehjemProps) {
  const foreslatteOppgaver = oppgaver.slice(0, 3)

  return (
    <>
      <section className="barnehelt" style={{ '--profilfarge': medlem.profilfarge } as React.CSSProperties}>
        <div className="heltinnhold">
          <span className="oyebryn lys">Din oppdragsuke</span>
          <h1>Hei, {medlem.navn}! {medlem.emoji}</h1>
          <p>Velg et oppdrag, gjør det skikkelig og send det til de voksne.</p>
          <div className="heltstatistikk">
            <div><strong>{formaterBelop(opptjening)}</strong><span>opptjent</span></div>
            <div><strong>{antallFullfort}</strong><span>fullført</span></div>
            <div><strong>{rekke} 🔥</strong><span>i rekke</span></div>
          </div>
        </div>
        <div className="heltfigur" aria-hidden="true">{medlem.emoji}</div>
      </section>

      <section className="rekke-kort">
        <div className="rekke-topp">
          <div>
            <span className="oyebryn">Mestringsrekke</span>
            <strong>{rekke} gode oppdrag på rad</strong>
          </div>
          <span className="flammemerke">🔥</span>
        </div>
        <div className="ukerad">
          {['M', 'T', 'O', 'T', 'F', 'L', 'S'].map((dag, indeks) => (
            <span className={indeks < rekke ? 'ferdig' : ''} key={`${dag}-${indeks}`}>{indeks < rekke ? '✓' : dag}</span>
          ))}
        </div>
      </section>

      <section className="seksjon">
        <div className="seksjonstopp">
          <div>
            <span className="oyebryn">Velg noe som passer</span>
            <h2>Dagens oppdrag</h2>
          </div>
          <button className="tekstknapp" type="button" onClick={() => settAktivFane('oppdrag')}>Se alle <ChevronRight size={16} /></button>
        </div>
        <div className="oppgavekortliste">
          {foreslatteOppgaver.map((oppgave) => {
            const venter = innsendinger.some(
              (innsending) => innsending.oppgaveId === oppgave.id && innsending.status === 'venter',
            )
            return (
              <Barnoppgavekort
                key={oppgave.id}
                oppgave={oppgave}
                venter={venter}
                onSendInn={sendInnOppgave}
              />
            )
          })}
        </div>
      </section>

      <section className="motivasjonskort">
        <div className="motivasjonsikon"><Medal size={26} /></div>
        <div>
          <span className="oyebryn">Neste merke</span>
          <strong>Husets hjelper</strong>
          <p>Du mangler {Math.max(0, 5 - antallFullfort)} godkjente oppdrag.</p>
        </div>
        <div className="ringprogresjon" style={{ '--fremdrift': `${Math.min(100, (antallFullfort / 5) * 100)}%` } as React.CSSProperties}>
          <span>{Math.min(5, antallFullfort)}/5</span>
        </div>
      </section>
    </>
  )
}

type AdministrerOppgaverProps = {
  oppgaver: Oppgave[]
  apneNyOppgave: () => void
  apneRedigering: (oppgave: Oppgave) => void
  slettOppgave: (oppgaveId: string) => void
}

function AdministrerOppgaver({ oppgaver, apneNyOppgave, apneRedigering, slettOppgave }: AdministrerOppgaverProps) {
  return (
    <>
      <Sideoverskrift
        oyebryn="Foreldreverktøy"
        tittel="Familiens oppdrag"
        tekst="Endringer blir synlige for barna med én gang når databasen kobles til."
        handling={
          <button className="hovedknapp" type="button" onClick={apneNyOppgave}>
            <Plus size={18} /> Ny oppgave
          </button>
        }
      />

      <div className="oppgaveadministrasjon">
        {oppgaver.map((oppgave) => (
          <article className={`adminoppgave ${oppgave.aktiv ? '' : 'arkivert'}`} key={oppgave.id}>
            <span className="storoppgaveemoji">{oppgave.emoji}</span>
            <div className="adminoppgaveinfo">
              <div className="adminoppgavetittel">
                <strong>{oppgave.tittel}</strong>
                {!oppgave.aktiv && <span className="arkivmerke">Arkivert</span>}
              </div>
              <p>{oppgave.beskrivelse || 'Ingen forklaring er lagt til.'}</p>
              <span className="beloplinje"><Coins size={15} /> {formaterBelop(oppgave.belop)} per gang</span>
            </div>
            <div className="radhandlinger">
              <button className="ikonknapp" type="button" onClick={() => apneRedigering(oppgave)} aria-label={`Rediger ${oppgave.tittel}`}>
                <Pencil size={18} />
              </button>
              {oppgave.aktiv && (
                <button className="ikonknapp fare" type="button" onClick={() => slettOppgave(oppgave.id)} aria-label={`Arkiver ${oppgave.tittel}`}>
                  <Trash2 size={18} />
                </button>
              )}
            </div>
          </article>
        ))}
      </div>
    </>
  )
}

type BarnetsOppgaverProps = {
  oppgaver: Oppgave[]
  innsendinger: Innsending[]
  sendInnOppgave: (oppgaveId: string) => void
}

function BarnetsOppgaver({ oppgaver, innsendinger, sendInnOppgave }: BarnetsOppgaverProps) {
  return (
    <>
      <Sideoverskrift
        oyebryn="Oppdragsmenyen"
        tittel="Hva vil du gjøre?"
        tekst="Trykk på «Jeg har gjort den» når hele oppgaven er ferdig."
      />
      <div className="oppgavekortliste">
        {oppgaver.map((oppgave) => {
          const siste = innsendinger.find((innsending) => innsending.oppgaveId === oppgave.id)
          return (
            <Barnoppgavekort
              key={oppgave.id}
              oppgave={oppgave}
              venter={siste?.status === 'venter'}
              sistGodkjent={siste?.status === 'godkjent' || siste?.status === 'betalt'}
              onSendInn={sendInnOppgave}
            />
          )
        })}
      </div>
    </>
  )
}

type BarnoppgavekortProps = {
  oppgave: Oppgave
  venter: boolean
  sistGodkjent?: boolean
  onSendInn: (oppgaveId: string) => void
}

function Barnoppgavekort({ oppgave, venter, sistGodkjent = false, onSendInn }: BarnoppgavekortProps) {
  return (
    <article className="barnoppgavekort">
      <div className="barnoppgaveikon">{oppgave.emoji}</div>
      <div className="barnoppgaveinfo">
        <div className="barnoppgavetopp">
          <strong>{oppgave.tittel}</strong>
          <span className="premiebrikke">{oppgave.belop} kr</span>
        </div>
        <p>{oppgave.beskrivelse}</p>
        {sistGodkjent && !venter && <span className="siststatus"><CircleCheckBig size={15} /> Godkjent sist gang</span>}
      </div>
      <button
        className={venter ? 'venterknapp' : 'sendknapp'}
        type="button"
        onClick={() => onSendInn(oppgave.id)}
        disabled={venter}
      >
        {venter ? <><Clock3 size={17} /> Venter på sjekk</> : <><Send size={17} /> Jeg har gjort den</>}
      </button>
    </article>
  )
}

type PokalerProps = {
  medlem: Medlem
  erAdministrator: boolean
  barn: Medlem[]
  data: Appdata
  finnOppgave: (oppgaveId: string) => Oppgave | undefined
  barnesaldo: (barnId: string, statuser?: Status[]) => number
  antallFullfort: number
  rekke: number
}

function Pokaler({ medlem, erAdministrator, barn, data, finnOppgave, barnesaldo, antallFullfort, rekke }: PokalerProps) {
  if (erAdministrator) {
    return (
      <>
        <Sideoverskrift
          oyebryn="Ukeoversikt"
          tittel="Familiens fremgang"
          tekst="Beløp og aktivitet er ekte i prototypen; poengsystemet kan tilpasses senere."
        />
        <div className="ledertavle">
          {barn
            .map((barnemedlem) => ({
              medlem: barnemedlem,
              antall: data.innsendinger.filter(
                (innsending) => innsending.barnId === barnemedlem.id && ['godkjent', 'betalt'].includes(innsending.status),
              ).length,
              opptjent: barnesaldo(barnemedlem.id, ['godkjent', 'betalt']),
            }))
            .sort((a, b) => b.antall - a.antall)
            .map((rad, indeks) => (
              <article className="lederrad" key={rad.medlem.id}>
                <span className={`plass plass-${indeks + 1}`}>{indeks + 1}</span>
                <span className="profilavatar" style={{ backgroundColor: rad.medlem.profilfarge }}>{rad.medlem.emoji}</span>
                <div>
                  <strong>{rad.medlem.navn}</strong>
                  <span>{rad.antall} godkjente oppdrag</span>
                </div>
                <strong>{formaterBelop(rad.opptjent)}</strong>
              </article>
            ))}
        </div>

        <section className="seksjon">
          <div className="seksjonstopp">
            <div>
              <span className="oyebryn">Siste høydepunkter</span>
              <h2>Familieveggen</h2>
            </div>
          </div>
          <div className="aktivitetsliste">
            {data.innsendinger
              .filter((innsending) => ['godkjent', 'betalt'].includes(innsending.status))
              .slice(0, 5)
              .map((innsending) => {
                const barnemedlem = data.medlemmer.find((element) => element.id === innsending.barnId)
                const oppgave = finnOppgave(innsending.oppgaveId)
                if (!barnemedlem || !oppgave) return null
                return (
                  <div className="aktivitetsrad" key={innsending.id}>
                    <span>{barnemedlem.emoji}</span>
                    <p><strong>{barnemedlem.navn}</strong> fullførte {oppgave.tittel.toLowerCase()}.</p>
                    <span className="poeng">+{oppgave.belop} kr</span>
                  </div>
                )
              })}
          </div>
        </section>
      </>
    )
  }

  const merker = [
    {
      navn: 'Første oppdrag',
      tekst: 'Fullfør ditt aller første oppdrag.',
      ikon: '🌱',
      oppnadd: antallFullfort >= 1,
    },
    {
      navn: 'Husets hjelper',
      tekst: 'Få fem oppdrag godkjent.',
      ikon: '🏠',
      oppnadd: antallFullfort >= 5,
    },
    {
      navn: 'I fyr og flamme',
      tekst: 'Bygg en rekke på sju oppdrag.',
      ikon: '🔥',
      oppnadd: rekke >= 7,
    },
    {
      navn: 'Sparemester',
      tekst: 'Tjen 200 kroner totalt.',
      ikon: '🐷',
      oppnadd: barnesaldo(medlem.id, ['godkjent', 'betalt']) >= 200,
    },
  ]

  return (
    <>
      <Sideoverskrift
        oyebryn="Din samling"
        tittel={`Pokaler til ${medlem.navn}`}
        tekst="Merker handler om innsats og gode vaner, ikke bare om beløpet."
      />
      <section className="pokalehelt">
        <div className="pokaleglans"><Trophy size={34} /></div>
        <div>
          <span className="oyebryn lys">Du har låst opp</span>
          <strong>{merker.filter((merke) => merke.oppnadd).length} av {merker.length} merker</strong>
          <p>Neste merke kommer nærmere for hvert godkjente oppdrag.</p>
        </div>
      </section>
      <div className="merkenett">
        {merker.map((merke) => (
          <article className={`merkekort ${merke.oppnadd ? 'oppnadd' : ''}`} key={merke.navn}>
            <span className="merkeemoji">{merke.oppnadd ? merke.ikon : '🔒'}</span>
            <strong>{merke.navn}</strong>
            <p>{merke.tekst}</p>
            <span className="merkestatus">{merke.oppnadd ? 'Låst opp' : 'Ikke ennå'}</span>
          </article>
        ))}
      </div>
    </>
  )
}

type FamilieProps = {
  data: Appdata
  erAdministrator: boolean
  redigerFamilie: boolean
  settRedigerFamilie: (verdi: boolean) => void
  settData: React.Dispatch<React.SetStateAction<Appdata>>
  oppdaterMedlem: (medlemId: string, felt: keyof Pick<Medlem, 'navn' | 'emoji' | 'profilfarge'>, verdi: string) => void
  leggTilBarn: () => void
  aktiverVarsler: () => Promise<void>
  nullstillDemo: () => void
}

function Familie({
  data,
  erAdministrator,
  redigerFamilie,
  settRedigerFamilie,
  settData,
  oppdaterMedlem,
  leggTilBarn,
  aktiverVarsler,
  nullstillDemo,
}: FamilieProps) {
  if (!erAdministrator) {
    return (
      <>
        <Sideoverskrift
          oyebryn="Vår lille klubb"
          tittel={data.innstillinger.familienavn}
          tekst="Bare dere i familien skal kunne se oppdrag, godkjenninger og beløp."
        />
        <div className="familienett">
          {data.medlemmer.map((medlem) => (
            <article className="familiemedlem" key={medlem.id}>
              <span className="familieavatar" style={{ backgroundColor: medlem.profilfarge }}>{medlem.emoji}</span>
              <strong>{medlem.navn}</strong>
              <span>{medlem.rolle === 'administrator' ? 'Voksen' : 'Oppdragsjeger'}</span>
            </article>
          ))}
        </div>
        <section className="personvernkort">
          <LockKeyhole size={26} />
          <div>
            <strong>Dette er familiens private rom</strong>
            <p>I den ferdige versjonen logger alle inn med sin egen konto. Barn kan ikke godkjenne oppdrag eller endre beløp.</p>
          </div>
        </section>
      </>
    )
  }

  return (
    <>
      <Sideoverskrift
        oyebryn="Tilpass appen"
        tittel="Familie og innstillinger"
        tekst="Gjør klubben deres egen uten å endre kode."
        handling={
          <button className="sekundarknapp" type="button" onClick={() => settRedigerFamilie(!redigerFamilie)}>
            <Pencil size={17} /> {redigerFamilie ? 'Ferdig' : 'Rediger'}
          </button>
        }
      />

      <section className="innstillingskort">
        <div className="innstillingsoverskrift">
          <span className="innstillingsikon"><Sparkles size={20} /></span>
          <div><strong>Klubbens identitet</strong><span>Navn og liten hilsen i toppen av appen</span></div>
        </div>
        <div className="skjemarad responsiv">
          <label>
            Familienavn
            <input
              disabled={!redigerFamilie}
              value={data.innstillinger.familienavn}
              onChange={(hendelse) =>
                settData((gammelData) => ({
                  ...gammelData,
                  innstillinger: { ...gammelData.innstillinger, familienavn: hendelse.target.value },
                }))
              }
            />
          </label>
          <label>
            Slagord
            <input
              disabled={!redigerFamilie}
              value={data.innstillinger.slagord}
              onChange={(hendelse) =>
                settData((gammelData) => ({
                  ...gammelData,
                  innstillinger: { ...gammelData.innstillinger, slagord: hendelse.target.value },
                }))
              }
            />
          </label>
        </div>
      </section>

      <section className="innstillingskort">
        <div className="innstillingsoverskrift">
          <span className="innstillingsikon"><Users size={20} /></span>
          <div><strong>Familiemedlemmer</strong><span>Navn, avatar og personlig farge</span></div>
        </div>
        <div className="medlemsredigering">
          {data.medlemmer.map((medlem) => (
            <article className="medlemsrad" key={medlem.id}>
              <span className="profilavatar stor" style={{ backgroundColor: medlem.profilfarge }}>{medlem.emoji}</span>
              <div className="medlemsfelt">
                <input
                  aria-label={`Navn på ${medlem.navn}`}
                  disabled={!redigerFamilie}
                  value={medlem.navn}
                  onChange={(hendelse) => oppdaterMedlem(medlem.id, 'navn', hendelse.target.value)}
                />
                <span>{medlem.rolle === 'administrator' ? 'Administrator' : 'Barn'}</span>
              </div>
              {redigerFamilie && (
                <div className="minivalg">
                  <select
                    aria-label={`Avatar for ${medlem.navn}`}
                    value={medlem.emoji}
                    onChange={(hendelse) => oppdaterMedlem(medlem.id, 'emoji', hendelse.target.value)}
                  >
                    {AVATARER.map((emoji) => <option key={emoji} value={emoji}>{emoji}</option>)}
                  </select>
                  <input
                    aria-label={`Profilfarge for ${medlem.navn}`}
                    type="color"
                    value={medlem.profilfarge}
                    onChange={(hendelse) => oppdaterMedlem(medlem.id, 'profilfarge', hendelse.target.value)}
                  />
                </div>
              )}
            </article>
          ))}
        </div>
        {redigerFamilie && (
          <button className="tekstknapp leggtil" type="button" onClick={leggTilBarn}><Plus size={17} /> Legg til et barn</button>
        )}
      </section>

      <section className="innstillingskort">
        <div className="innstillingsoverskrift">
          <span className="innstillingsikon"><Bell size={20} /></span>
          <div><strong>Ukentlig utbetaling</strong><span>Når de voksne skal få varsel om beløpet</span></div>
        </div>
        <div className="skjemarad responsiv">
          <label>
            Dag
            <select
              disabled={!redigerFamilie}
              value={data.innstillinger.utbetalingsdag}
              onChange={(hendelse) =>
                settData((gammelData) => ({
                  ...gammelData,
                  innstillinger: { ...gammelData.innstillinger, utbetalingsdag: hendelse.target.value },
                }))
              }
            >
              {UKEDAGER.map((dag) => <option key={dag} value={dag}>{dag}</option>)}
            </select>
          </label>
          <label>
            Klokkeslett
            <input
              type="time"
              disabled={!redigerFamilie}
              value={data.innstillinger.utbetalingstid}
              onChange={(hendelse) =>
                settData((gammelData) => ({
                  ...gammelData,
                  innstillinger: { ...gammelData.innstillinger, utbetalingstid: hendelse.target.value },
                }))
              }
            />
          </label>
        </div>
        <div className="infoboks">
          <Bell size={18} />
          <p><strong>Testvarsel virker allerede.</strong> Det automatiske ukevarselet krever Supabase og en liten gratis serverjobb.</p>
          <button className="sekundarknapp kompakt" type="button" onClick={aktiverVarsler}>Test varsel</button>
        </div>
      </section>

      <section className="innstillingskort sikkerhet">
        <div className="innstillingsoverskrift">
          <span className="innstillingsikon"><LockKeyhole size={20} /></span>
          <div><strong>Tilgang og sikkerhet</strong><span>Planen for den delte familieversjonen</span></div>
        </div>
        <ul className="sjekkliste">
          <li><Check size={17} /> Egen innlogging for hvert familiemedlem</li>
          <li><Check size={17} /> Barn kan sende inn, men ikke godkjenne</li>
          <li><Check size={17} /> Foreldre kan redigere oppgaver og beløp</li>
          <li><Check size={17} /> Data skjermes med tilgangsregler i databasen</li>
        </ul>
      </section>

      <button className="nullstillknapp" type="button" onClick={nullstillDemo}>
        <RotateCcw size={17} /> Nullstill demoinnhold
      </button>
    </>
  )
}

type SideoverskriftProps = {
  oyebryn: string
  tittel: string
  tekst: string
  handling?: React.ReactNode
}

function Sideoverskrift({ oyebryn, tittel, tekst, handling }: SideoverskriftProps) {
  return (
    <section className="sideoverskrift">
      <div>
        <span className="oyebryn">{oyebryn}</span>
        <h1>{tittel}</h1>
        <p>{tekst}</p>
      </div>
      {handling}
    </section>
  )
}

type MenyknappProps = {
  aktiv: boolean
  etikett: string
  onClick: () => void
  children: React.ReactNode
}

function Menyknapp({ aktiv, etikett, onClick, children }: MenyknappProps) {
  return (
    <button className={aktiv ? 'aktiv' : ''} type="button" onClick={onClick}>
      <span className="menyikon">{children}</span>
      <span>{etikett}</span>
    </button>
  )
}

type ModalProps = {
  tittel: string
  onClose: () => void
  children: React.ReactNode
}

function Modal({ tittel, onClose, children }: ModalProps) {
  return (
    <div className="modalbakgrunn" role="presentation" onMouseDown={onClose}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={tittel} onMouseDown={(hendelse) => hendelse.stopPropagation()}>
        <div className="modaltopp">
          <h2>{tittel}</h2>
          <button className="ikonknapp" type="button" onClick={onClose} aria-label="Lukk"><X size={20} /></button>
        </div>
        {children}
      </section>
    </div>
  )
}

type ProfilradProps = {
  medlem: Medlem
  aktiv: boolean
  onClick: (medlemId: string) => void
}

function Profilrad({ medlem, aktiv, onClick }: ProfilradProps) {
  return (
    <button className={`profilrad ${aktiv ? 'aktiv' : ''}`} type="button" onClick={() => onClick(medlem.id)}>
      <span className="profilavatar stor" style={{ backgroundColor: medlem.profilfarge }}>{medlem.emoji}</span>
      <span>
        <strong>{medlem.navn}</strong>
        <small>{medlem.rolle === 'administrator' ? 'Administrator' : 'Barn'}</small>
      </span>
      {aktiv && <CircleCheckBig size={21} />}
    </button>
  )
}

type TomtilstandProps = {
  ikon: React.ReactNode
  tittel: string
  tekst: string
}

function Tomtilstand({ ikon, tittel, tekst }: TomtilstandProps) {
  return (
    <div className="tomtilstand">
      <span>{ikon}</span>
      <strong>{tittel}</strong>
      <p>{tekst}</p>
    </div>
  )
}

function Feiring() {
  const biter = Array.from({ length: 24 }, (_, indeks) => indeks)
  return (
    <div className="feiring" aria-hidden="true">
      {biter.map((indeks) => <i key={indeks} style={{ '--i': indeks } as React.CSSProperties} />)}
      <div className="feiringstekst"><Star size={20} fill="currentColor" /> Bra jobbet!</div>
    </div>
  )
}

export default App
