import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowLeftRight, Bell, Check, ChevronRight, CircleHelp, ClipboardCheck,
  Home, Inbox, Info, LibraryBig, LockKeyhole, MapPin, Menu, PackageOpen,
  Plus, Search, ShieldCheck, Sparkles, Trash2, UserRoundCheck, X, LogOut
} from 'lucide-react'
import { collection, demoCollectors, venues as demoVenues } from './data'
import { allStickerCodes, canonicalizeStickerCode, isStickerCode, stickerGroups } from './catalog'
import { findReciprocalMatches, normalizeStickerIds } from './lib/matching'
import { signInWithEmail, isSupabaseConfigured, supabase } from './lib/supabase'
import { storage } from './lib/storage'
import type { Exchange, Inventory, Match, MatchNotification, View } from './types'
import { confirmBackendExchange, createProfile, deleteAccount, getProfile, loadWorkspace, markMatchNotificationsRead, proposeBackendExchange, saveInventory, setBackendExchangeStatus, signOut, updateMatchNotifications, type ParentProfile } from './backend'

const navItems: Array<{ id: View; label: string; icon: typeof Home }> = [
  { id: 'inventaire', label: 'Mes vignettes', icon: LibraryBig },
  { id: 'matches', label: 'Correspondances', icon: Sparkles },
  { id: 'echanges', label: 'Mes échanges', icon: ArrowLeftRight },
  { id: 'securite', label: 'Sécurité', icon: ShieldCheck }
]

function Brand({ compact = false }: { compact?: boolean }) {
  return <div className="brand" aria-label="Bourse aux vignettes Bruxelles">
    <div className="brand-mark"><span /><span /></div>
    {!compact && <div><strong>Bourse aux vignettes</strong><small>Bruxelles · entre parents</small></div>}
  </div>
}

function StickerPills({ ids, tone = 'navy' }: { ids: string[]; tone?: 'navy' | 'orange' }) {
  return <div className={`number-pills ${tone}`}>
    {ids.map((id) => <span key={id}>{id}</span>)}
  </div>
}

function StickerCatalog({ selected, onToggle }: { selected: string[]; onToggle: (code: string) => void }) {
  const [activeGroup, setActiveGroup] = useState('official')
  const [query, setQuery] = useState('')
  const normalizedQuery = canonicalizeStickerCode(query)
  const group = stickerGroups.find((item) => item.id === activeGroup) ?? stickerGroups[0]
  const visibleGroups = query.trim()
    ? stickerGroups.map((item) => ({ ...item, codes: item.codes.filter((code) => code.includes(normalizedQuery)) })).filter((item) => item.codes.length)
    : [group]

  return <section className="catalog-browser" aria-labelledby="catalog-title">
    <div className="catalog-toolbar">
      <div><span className="eyebrow">Catalogue officiel</span><h2 id="catalog-title">Choisir dans les {allStickerCodes.length} codes</h2></div>
      <label className="catalog-search"><Search size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher un code…" aria-label="Rechercher un code"/></label>
    </div>
    <div className="catalog-body">
      <nav className="country-list" aria-label="Pays">
        {stickerGroups.map((item) => {
          const selectedCount = item.codes.filter((code) => selected.includes(code)).length
          return <button key={item.id} className={!query && item.id === activeGroup ? 'active' : ''} onClick={() => { setActiveGroup(item.id); setQuery('') }}>
            <span className="country-code">{item.country}</span><span>{item.label}</span><b title={`${selectedCount} sélectionnés sur ${item.codes.length}`}>{selectedCount}/{item.codes.length}</b>
          </button>
        })}
      </nav>
      <div className="catalog-results">
        {visibleGroups.length ? visibleGroups.map((item) => <div className="catalog-group" key={item.id}>
          <div className="catalog-group-heading"><div><strong>{item.label}</strong><span>{item.country}</span></div><small>{item.codes.length} code{item.codes.length > 1 ? 's' : ''}</small></div>
          <motion.div layout className="catalog-code-grid">
            {item.codes.map((code) => <motion.button layout key={code} className={selected.includes(code) ? 'selected' : ''} onClick={() => onToggle(code)} aria-pressed={selected.includes(code)}>
              <span>{code}</span>{selected.includes(code) && <Check size={14}/>} 
            </motion.button>)}
          </motion.div>
        </div>) : <div className="catalog-empty">Aucun code ne correspond à « {query} ».</div>}
      </div>
    </div>
  </section>
}

function Onboarding({ onDone }: { onDone: () => void }) {
  const [adult, setAdult] = useState(false)
  const [rules, setRules] = useState(false)
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const continueFlow = async () => {
    if (!adult || !rules) return
    setBusy(true)
    setError('')
    setMessage('')
    storage.confirmAdult()
    if (isSupabaseConfigured) {
      const cleanedEmail = email.trim()
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanedEmail)) {
        setError('Indiquez une adresse email valide pour recevoir le lien de connexion.')
        setBusy(false)
        return
      }
      const { error: signInError } = await signInWithEmail(cleanedEmail)
      if (signInError) setError(signInError.message)
      else setMessage('Lien envoye. Ouvrez votre email puis revenez ici pour creer votre profil parent.')
    } else {
      onDone()
    }
    setBusy(false)
  }

  return <main className="welcome-shell">
    <header className="welcome-nav">
      <Brand />
      <nav className="landing-nav" aria-label="Navigation principale">
        <a href="#fonctionnement">Comment ça marche</a>
        <a href="#securite">Sécurité</a>
        <a className="nav-cta" href="#commencer">Commencer</a>
      </nav>
    </header>
    <section className="welcome-hero">
      <motion.div className="welcome-copy" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: .55 }}>
        <span className="eyebrow">Le rendez-vous des albums incomplets</span>
        <h1>Les doubles des uns.<br/><em>Les trouvailles des autres.</em></h1>
        <p>Organisez des échanges de vignettes entre parents, dans des lieux publics à Bruxelles. Gratuitement, simplement, sans exposer les enfants.</p>
        <div className="hero-actions">
          <a className="primary-button" href="#commencer">Créer mon inventaire <ChevronRight size={18}/></a>
          <a className="text-link" href="#fonctionnement">Voir comment ça marche</a>
        </div>
        <div className="principles" aria-label="Principes de sécurité">
          <span><ShieldCheck size={18}/> Parents uniquement</span>
          <span><MapPin size={18}/> Lieux publics</span>
          <span><LockKeyhole size={18}/> Aucune donnée d’enfant</span>
        </div>
      </motion.div>
      <motion.div className="sticker-scene" initial={{ opacity: 0, scale: .9, rotate: -3 }} animate={{ opacity: 1, scale: 1, rotate: 0 }} transition={{ delay: .15, duration: .6 }} aria-hidden="true">
        <div className="big-sticker back"><span>MEX 8</span><small>DOUBLE</small></div>
        <div className="big-sticker front"><span>BRA 14</span><small>RECHERCHÉE</small></div>
        <ArrowLeftRight className="swap-arrow" size={44}/>
      </motion.div>
    </section>

    <section className="landing-how" id="fonctionnement">
      <div className="landing-section-heading">
        <span className="section-index">01</span>
        <div><span className="eyebrow">Comment ça marche</span><h2>Trois étapes.<br/>Aucun message à rédiger.</h2></div>
      </div>
      <div className="how-layout">
        <div className="how-steps">
          {[
            ['01', 'Créez votre inventaire', 'Choisissez un pays, puis cochez vos doubles et les vignettes qui vous manquent parmi les 992 codes officiels.'],
            ['02', 'Recevez des correspondances', 'L’application trouve les parents qui possèdent ce que vous cherchez et recherchent ce que vous avez.'],
            ['03', 'Fixez un échange public', 'Proposez un lieu bruxellois et un créneau prédéfinis. Aucune adresse privée ni discussion libre.']
          ].map(([number, title, copy], index) => <motion.article key={number} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .35 }} transition={{ delay: index * .08 }}>
            <span>{number}</span><div><h3>{title}</h3><p>{copy}</p></div>
          </motion.article>)}
        </div>
        <motion.div className="landing-product-preview" initial={{ opacity: 0, scale: .96 }} whileInView={{ opacity: 1, scale: 1 }} viewport={{ once: true, amount: .25 }}>
          <div className="preview-top"><span/><span/><span/><small>Mon inventaire · Mondial 2026</small></div>
          <div className="preview-tabs"><b>Mes doubles <i>3</i></b><span>Je recherche <i>2</i></span></div>
          <div className="preview-catalog">
            <div className="preview-countries"><b>BEL</b><span>FRA</span><span>MAR</span><span>BRA</span></div>
            <div><small>Belgique · 20 codes</small><div className="preview-codes"><span>BEL 1</span><span className="picked">BEL 2 <Check size={12}/></span><span>BEL 3</span><span>BEL 4</span><span className="picked">BEL 5 <Check size={12}/></span><span>BEL 6</span></div></div>
          </div>
          <p><ShieldCheck size={16}/> Vos listes complètes restent privées.</p>
        </motion.div>
      </div>
    </section>

    <section className="landing-match">
      <div className="match-story-copy"><span className="eyebrow">Le bon échange, automatiquement</span><h2>Vous avez ce qu’elle cherche.<br/><em>Elle a ce qu’il vous manque.</em></h2><p>Une correspondance apparaît uniquement quand l’échange fonctionne dans les deux sens.</p></div>
      <motion.div className="match-story-visual" initial={{ opacity: 0, x: 24 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true, amount: .3 }}>
        <div className="story-person"><div className="avatar">N</div><div><strong>Nora B.</strong><span><MapPin size={13}/> Ixelles</span></div><small><ShieldCheck size={14}/> 100% fiable</small></div>
        <div className="story-trade"><div><small>Vous recevez</small><span>BRA 14</span><span>FRA 8</span></div><ArrowLeftRight size={24}/><div><small>Vous donnez</small><span>BEL 2</span><span>MAR 11</span></div></div>
        <div className="story-action"><span>4 vignettes à échanger</span><b>Proposer un rendez-vous <ChevronRight size={16}/></b></div>
      </motion.div>
    </section>

    <section className="landing-safety" id="securite">
      <div className="landing-section-heading"><span className="section-index">02</span><div><span className="eyebrow">Pensé pour les familles</span><h2>La sécurité n’est pas une option.</h2></div></div>
      <div className="safety-manifesto">
        <p>La plateforme organise des échanges <em>entre adultes</em>, au bénéfice des collections des enfants — sans jamais collecter leurs données.</p>
        <div>{[
          ['Comptes adultes', 'Chaque compte et chaque rendez-vous sont gérés par un parent ou responsable majeur.'],
          ['Aucune donnée d’enfant', 'Ni nom, ni âge, ni photo, ni école, ni adresse ne sont demandés.'],
          ['Lieux publics', 'Les rencontres se font dans une bibliothèque ou un espace public approuvé.'],
          ['Échange uniquement', 'Aucune vente, paiement, enchère ou publicité ciblée.']
        ].map(([title, copy], index) => <div key={title}><span>0{index + 1}</span><div><strong>{title}</strong><small>{copy}</small></div></div>)}</div>
      </div>
    </section>

    <motion.section className="welcome-gate" id="commencer" initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, amount: .25 }}>
      <div><span className="step-label">Avant de commencer</span><h2>Un espace réservé aux adultes</h2><p>Le compte et les rendez-vous sont gérés par un parent ou responsable adulte.</p></div>
      <div className="checks">
        <label><input type="checkbox" checked={adult} onChange={(e) => setAdult(e.target.checked)}/><span><Check size={15}/></span>J’ai 18 ans ou plus et je gère ce compte.</label>
        <label><input type="checkbox" checked={rules} onChange={(e) => setRules(e.target.checked)}/><span><Check size={15}/></span>Je n’indiquerai aucune donnée concernant un enfant.</label>
        {isSupabaseConfigured && <label className="email-login">Adresse email du parent
          <input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="parent@example.com" autoComplete="email"/>
        </label>}
        <button className="primary-button" disabled={!adult || !rules || busy} onClick={continueFlow}>
          {busy ? 'Connexion...' : isSupabaseConfigured ? 'Recevoir le lien de connexion' : 'Découvrir le prototype'} <ChevronRight size={18}/>
        </button>
        {message && <small className="success-note"><Check size={14}/>{message}</small>}
        {error && <small className="gate-error"><Info size={14}/>{error}</small>}
        {!isSupabaseConfigured && <small className="demo-note"><Info size={14}/> Mode démonstration local — aucune donnée n’est envoyée.</small>}
      </div>
    </motion.section>
    <footer className="welcome-footer">Bourse aux vignettes Bruxelles n’est ni affiliée ni sponsorisée par Panini.</footer>
  </main>
}

const brusselsCommunes = [
  'Anderlecht','Auderghem','Berchem-Sainte-Agathe','Bruxelles-Ville','Etterbeek','Evere','Forest','Ganshoren','Ixelles',
  'Jette','Koekelberg','Molenbeek-Saint-Jean','Saint-Gilles','Saint-Josse-ten-Noode','Schaerbeek','Uccle',
  'Watermael-Boitsfort','Woluwe-Saint-Lambert','Woluwe-Saint-Pierre'
]

function ProfileSetup({ userId, onCreated }: { userId: string; onCreated: (profile: ParentProfile) => void }) {
  const [alias, setAlias] = useState('')
  const [commune, setCommune] = useState('Bruxelles-Ville')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    const cleaned = alias.trim()
    if (!/^[\p{L}][\p{L} .'-]{0,30}$/u.test(cleaned)) { setError('Choisissez un alias adulte court, par exemple « Nora B. ».'); return }
    setBusy(true); setError('')
    try { onCreated(await createProfile(userId, cleaned, commune)) }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Impossible de créer le profil.') }
    finally { setBusy(false) }
  }
  return <main className="profile-setup-shell"><section className="profile-setup">
    <Brand/><span className="eyebrow">Dernière étape</span><h1>Votre profil parent</h1><p>L’autre parent verra uniquement cet alias et votre commune. Votre adresse e-mail reste privée.</p>
    <label>Alias adulte<input value={alias} onChange={(e) => setAlias(e.target.value)} placeholder="Ex. Nora B." maxLength={31}/></label>
    <label>Commune<select value={commune} onChange={(e) => setCommune(e.target.value)}>{brusselsCommunes.map((item) => <option key={item}>{item}</option>)}</select></label>
    {error && <p className="form-error" role="alert">{error}</p>}
    <button className="primary-button" onClick={submit} disabled={busy || !alias.trim()}>{busy ? 'Création…' : 'Créer mon profil'} <ChevronRight size={18}/></button>
    <small><LockKeyhole size={14}/> Aucune information concernant un enfant.</small>
  </section></main>
}

function InventoryView({ inventory, setInventory, matchCount }: { inventory: Inventory; setInventory: (value: Inventory) => void; matchCount: number }) {
  const [mode, setMode] = useState<'doubles' | 'wanted'>('doubles')
  const [entry, setEntry] = useState('')
  const [entryError, setEntryError] = useState('')
  const selected = inventory[mode]

  const addStickers = () => {
    const additions = entry.split(/[,;\n]+/).filter(Boolean).map(canonicalizeStickerCode)
    const invalid = additions.filter((value) => !isStickerCode(value))
    if (invalid.length) { setEntryError(`Code inconnu : ${invalid.join(', ')}.`); return }
    const otherMode = mode === 'doubles' ? 'wanted' : 'doubles'
    setInventory({ ...inventory, [mode]: normalizeStickerIds([...selected, ...additions]), [otherMode]: inventory[otherMode].filter((code) => !additions.includes(code)) })
    setEntry('')
    setEntryError('')
  }

  const remove = (id: string) => setInventory({ ...inventory, [mode]: selected.filter((item) => item !== id) })
  const toggle = (code: string) => {
    if (selected.includes(code)) { remove(code); return }
    const otherMode = mode === 'doubles' ? 'wanted' : 'doubles'
    setInventory({ ...inventory, [mode]: normalizeStickerIds([...selected, code]), [otherMode]: inventory[otherMode].filter((item) => item !== code) })
  }

  return <motion.section className="workspace" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
    <div className="page-heading">
      <div><span className="eyebrow">Collection active</span><h1>{collection.title}</h1><p>{collection.edition} · {collection.total} vignettes</p></div>
      <div className="match-callout"><Sparkles size={19}/><strong>{matchCount}</strong><span>correspondances<br/>réciproques</span></div>
    </div>
    <div className="inventory-tabs" role="tablist">
      <button className={mode === 'doubles' ? 'active' : ''} onClick={() => setMode('doubles')} role="tab"><PackageOpen size={18}/> Mes doubles <b>{inventory.doubles.length}</b></button>
      <button className={mode === 'wanted' ? 'active' : ''} onClick={() => setMode('wanted')} role="tab"><Search size={18}/> Je recherche <b>{inventory.wanted.length}</b></button>
    </div>
    <div className="inventory-editor">
      <div className="entry-line">
        <label htmlFor="sticker-ids">Ajouter des identifiants</label>
        <div><input id="sticker-ids" autoCapitalize="characters" maxLength={100} placeholder="Ex. MEX 2, BRA 14" value={entry} onChange={(e) => { setEntry(e.target.value.toUpperCase()); setEntryError('') }} onKeyDown={(e) => e.key === 'Enter' && addStickers()}/><button onClick={addStickers} disabled={!entry.trim()}><Plus size={18}/> Ajouter</button></div>
        <small>Séparez plusieurs codes exacts par une virgule.</small>
        {entryError && <p className="entry-error" role="alert">{entryError}</p>}
      </div>
      <div className="selected-numbers">
        <div className="selection-header"><h2>{mode === 'doubles' ? 'Disponibles à l’échange' : 'Vignettes manquantes'}</h2><span>{selected.length} vignette{selected.length > 1 ? 's' : ''}</span></div>
        {selected.length ? <motion.div layout className="number-grid">{selected.map((id) => <motion.button layout key={id} onClick={() => remove(id)} aria-label={`Retirer la vignette ${id}`}><span>{id}</span><X size={14}/></motion.button>)}</motion.div> : <div className="empty-inline">Aucun identifiant ajouté pour le moment.</div>}
      </div>
    </div>
    <StickerCatalog selected={selected} onToggle={toggle}/>
    <div className="privacy-strip"><ShieldCheck size={20}/><div><strong>Votre inventaire reste privé</strong><span>Seuls les identifiants utiles à une correspondance sont montrés à l’autre parent.</span></div></div>
  </motion.section>
}

function MatchesView({ matches, onPropose }: { matches: Match[]; onPropose: (match: Match) => void }) {
  return <motion.section className="workspace" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
    <div className="page-heading"><div><span className="eyebrow">Calcul automatique</span><h1>Correspondances</h1><p>Chaque parent a au moins une vignette utile à l’autre.</p></div></div>
    {matches.length ? <div className="matches-list">
      {matches.map((match, index) => <motion.article key={match.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * .08 }}>
        <div className="match-person"><div className="avatar">{match.adultAlias[0]}</div><div><h2>{match.adultAlias}</h2><p><MapPin size={14}/>{match.commune}</p></div><span className="reliability"><ShieldCheck size={15}/>{match.reliability}% fiable</span></div>
        <div className="trade-flow">
          <div><small>Vous recevez</small><StickerPills ids={match.gives} tone="orange"/></div>
          <ArrowLeftRight size={24}/>
          <div><small>Vous donnez</small><StickerPills ids={match.receives}/></div>
        </div>
        <div className="match-action"><span>{match.exchanges} échange{match.exchanges !== 1 ? 's' : ''} réalisé{match.exchanges !== 1 ? 's' : ''}</span><button onClick={() => onPropose(match)}>Proposer un rendez-vous <ChevronRight size={17}/></button></div>
      </motion.article>)}
    </div> : <div className="empty-state"><Search size={34}/><h2>Pas encore de correspondance</h2><p>Ajoutez quelques doubles et identifiants recherchés pour lancer le calcul.</p></div>}
  </motion.section>
}

function ProposalModal({ match, venues, onClose, onConfirm }: { match: Match; venues: typeof demoVenues; onClose: () => void; onConfirm: (exchange: Exchange) => void }) {
  const [venueId, setVenueId] = useState(venues[0]?.id ?? '')
  const tomorrow = new Date(Date.now() + 86400000)
  const [date, setDate] = useState(tomorrow.toISOString().slice(0, 10))
  const [slot, setSlot] = useState('14:00–15:00')
  const venue = venues.find((item) => item.id === venueId)
  const confirm = () => venue && onConfirm({ id: crypto.randomUUID(), match, venue, date, slot, status: 'propose', code: Math.random().toString(36).slice(2, 8).toUpperCase(), canConfirm: false })

  return <motion.div className="modal-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.div className="modal" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="proposal-title">
      <button className="modal-close" onClick={onClose} aria-label="Fermer"><X/></button>
      <span className="eyebrow">Échange avec {match.adultAlias}</span><h2 id="proposal-title">Proposer un rendez-vous</h2><p>Uniquement dans un lieu public prédéfini, pendant ses heures d’ouverture.</p>
      {venues.length ? <label>Lieu public<select value={venueId} onChange={(e) => setVenueId(e.target.value)}>{venues.map((item) => <option key={item.id} value={item.id}>{item.name} — {item.commune}</option>)}</select><small>{venue?.note}</small></label> : <div className="no-venues"><MapPin size={19}/><span>Aucun lieu n’est encore approuvé pour le pilote.</span></div>}
      <div className="modal-fields"><label>Date<input type="date" min={tomorrow.toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)}/></label><label>Créneau<select value={slot} onChange={(e) => setSlot(e.target.value)}><option>10:00–11:00</option><option>11:00–12:00</option><option>14:00–15:00</option><option>15:00–16:00</option><option>16:00–17:00</option></select></label></div>
      <div className="no-chat"><LockKeyhole size={19}/><span>Aucun message libre ni coordonnée personnelle ne sera envoyé.</span></div>
      <button className="primary-button" onClick={confirm} disabled={!venue}>Envoyer la proposition <ChevronRight size={18}/></button>
    </motion.div>
  </motion.div>
}

function ExchangesView({ exchanges, updateExchange }: { exchanges: Exchange[]; updateExchange: (id: string, status: Exchange['status']) => void }) {
  const statusLabel = { propose: 'En attente', confirme: 'Confirmé', termine: 'Terminé', annule: 'Annulé' }
  return <motion.section className="workspace" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
    <div className="page-heading"><div><span className="eyebrow">Suivi</span><h1>Mes échanges</h1><p>Rendez-vous organisés sans partager vos coordonnées.</p></div></div>
    {exchanges.length ? <div className="exchange-list">{exchanges.map((exchange) => <article key={exchange.id}>
      <div className="date-tile"><strong>{new Date(exchange.date + 'T12:00:00').toLocaleDateString('fr-BE', { day: '2-digit' })}</strong><span>{new Date(exchange.date + 'T12:00:00').toLocaleDateString('fr-BE', { month: 'short' })}</span></div>
      <div className="exchange-main"><span className={`status ${exchange.status}`}>{statusLabel[exchange.status]}</span><h2>{exchange.match.adultAlias}</h2><p><MapPin size={14}/>{exchange.venue.name} · {exchange.slot}</p><div className="mini-trade"><span>Recevoir : {exchange.match.gives.join(', ')}</span><span>Donner : {exchange.match.receives.join(', ')}</span></div></div>
      <div className="exchange-actions">{exchange.status === 'propose' && <>{exchange.canConfirm !== false ? <button onClick={() => updateExchange(exchange.id, 'confirme')}><Check size={16}/> Accepter la proposition</button> : <span className="waiting-note">Réponse de l’autre parent attendue</span>}<button className="danger-link" onClick={() => updateExchange(exchange.id, 'annule')}>Annuler</button></>}{exchange.status === 'confirme' && <><span className="meeting-code">Code : <b>{exchange.code}</b></span><button onClick={() => updateExchange(exchange.id, 'termine')}><ClipboardCheck size={16}/> Marquer terminé</button></>}{exchange.status === 'termine' && <span className="complete-note"><Check size={16}/> Échange clôturé</span>}</div>
    </article>)}</div> : <div className="empty-state"><ArrowLeftRight size={34}/><h2>Aucun rendez-vous</h2><p>Une proposition apparaîtra ici après avoir choisi une correspondance.</p></div>}
  </motion.section>
}

function SafetyView({ matchNotificationsEnabled, onToggleMatchNotifications, onReset }: { matchNotificationsEnabled: boolean; onToggleMatchNotifications: () => void; onReset: () => void }) {
  return <motion.section className="workspace" initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }}>
    <div className="page-heading"><div><span className="eyebrow">Compte adulte</span><h1>Sécurité et données</h1><p>Des règles simples pour protéger toutes les familles.</p></div></div>
    <div className="safety-layout">
      <div className="safety-rules"><h2>Les règles de la bourse</h2>{[
        ['Aucune donnée d’enfant', 'N’indiquez jamais de nom, âge, photo, école ou activité d’un enfant.'],
        ['Rendez-vous entre adultes', 'Le parent qui organise l’échange se présente au lieu convenu.'],
        ['Lieux publics uniquement', 'Les adresses privées et les rendez-vous isolés ne sont jamais proposés.'],
        ['Pas de vente', 'La plateforme sert exclusivement aux échanges gratuits de vignettes.']
      ].map(([title, copy], index) => <div key={title}><span>{index + 1}</span><div><strong>{title}</strong><p>{copy}</p></div></div>)}</div>
      <aside className="data-panel"><ShieldCheck size={31}/><h2>Vos données</h2><p>Votre inventaire sert uniquement à trouver des correspondances utiles entre parents.</p><button onClick={onToggleMatchNotifications}><Bell size={17}/> Notifications de matching : {matchNotificationsEnabled ? 'activées' : 'désactivées'}</button><button><Inbox size={17}/> Exporter mes données</button><button><CircleHelp size={17}/> Signaler un problème</button><button className="delete-button" onClick={onReset}><Trash2 size={17}/> Supprimer mon compte</button><small>Service indépendant, non affilié à Panini. Aucun logo ou visuel officiel n’est utilisé.</small></aside>
    </div>
  </motion.section>
}

export default function App() {
  const [route, setRoute] = useState(window.location.pathname)
  const [onboarded, setOnboarded] = useState(storage.isConfirmedAdult())
  const [authUserId, setAuthUserId] = useState<string | null>(null)
  const [profile, setProfile] = useState<ParentProfile | null>(null)
  const [backendLoading, setBackendLoading] = useState(isSupabaseConfigured)
  const [backendError, setBackendError] = useState('')
  const [collectionId, setCollectionId] = useState<string | null>(null)
  const [view, setView] = useState<View>('inventaire')
  const [inventory, setInventoryState] = useState<Inventory>(storage.getInventory())
  const [exchanges, setExchanges] = useState<Exchange[]>(storage.getExchanges())
  const [backendMatches, setBackendMatches] = useState<Match[]>([])
  const [matchNotifications, setMatchNotifications] = useState<MatchNotification[]>([])
  const [runtimeVenues, setRuntimeVenues] = useState(isSupabaseConfigured ? [] : demoVenues)
  const [proposal, setProposal] = useState<Match | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const demoMatches = useMemo(() => findReciprocalMatches(inventory, demoCollectors), [inventory])
  const matches = isSupabaseConfigured ? backendMatches : demoMatches

  const refreshWorkspace = async () => {
    if (!isSupabaseConfigured || !profile) return
    try {
      const workspace = await loadWorkspace()
      setCollectionId(workspace.collectionId); setInventoryState(workspace.inventory); setBackendMatches(workspace.matches); setExchanges(workspace.exchanges); setMatchNotifications(workspace.matchNotifications); setRuntimeVenues(workspace.venues); setBackendError('')
    } catch (cause) { setBackendError(cause instanceof Error ? cause.message : 'Impossible de charger vos données.') }
  }
  const setInventory = (next: Inventory) => {
    setInventoryState(next)
    if (!isSupabaseConfigured) storage.setInventory(next)
    else if (collectionId) void saveInventory(collectionId, next).then(refreshWorkspace).catch((cause) => setBackendError(cause instanceof Error ? cause.message : 'Inventaire non enregistré.'))
  }
  const addExchange = async (exchange: Exchange) => {
    if (isSupabaseConfigured && collectionId) {
      try { await proposeBackendExchange(collectionId, exchange.match, exchange.venue, exchange.date, exchange.slot); await refreshWorkspace() }
      catch (cause) { setBackendError(cause instanceof Error ? cause.message : 'Proposition non envoyée.'); return }
    } else {
      const next = [exchange, ...exchanges]; setExchanges(next); storage.setExchanges(next)
    }
    setProposal(null); setView('echanges')
  }
  const updateExchange = async (id: string, status: Exchange['status']) => {
    if (isSupabaseConfigured) {
      try {
        if (status === 'confirme') await confirmBackendExchange(id)
        else if (status === 'annule') await setBackendExchangeStatus(id, 'cancelled')
        else if (status === 'termine') await setBackendExchangeStatus(id, 'completed')
        await refreshWorkspace()
      } catch (cause) { setBackendError(cause instanceof Error ? cause.message : 'Échange non mis à jour.') }
    } else {
      const next = exchanges.map((item) => item.id === id ? { ...item, status } : item); setExchanges(next); storage.setExchanges(next)
    }
  }
  const enterApp = () => { window.history.pushState({}, '', '/app'); setRoute('/app'); setOnboarded(true); window.scrollTo(0, 0) }
  const leaveForLanding = () => { window.history.replaceState({}, '', '/'); setRoute('/'); setProfile(null); setAuthUserId(null); setOnboarded(false); window.scrollTo(0, 0) }
  const handleSignOut = async () => { if (isSupabaseConfigured) await signOut(); else storage.clear(); leaveForLanding() }
  const toggleMatchNotifications = async () => {
    if (!isSupabaseConfigured || !profile) return
    try { setProfile(await updateMatchNotifications(profile.id, !profile.match_notifications_enabled)); setBackendError('') }
    catch (cause) { setBackendError(cause instanceof Error ? cause.message : 'Préférence de notifications non enregistrée.') }
  }
  const dismissMatchNotifications = async (openMatches = false) => {
    if (openMatches) setView('matches')
    if (!isSupabaseConfigured || !matchNotifications.length) return
    try { await markMatchNotificationsRead(); await refreshWorkspace() }
    catch (cause) { setBackendError(cause instanceof Error ? cause.message : 'Notifications non mises à jour.') }
  }
  const reset = async () => { if (isSupabaseConfigured) await deleteAccount(); storage.clear(); setInventoryState(storage.getInventory()); setExchanges([]); leaveForLanding() }
  useEffect(() => setMenuOpen(false), [view])
  useEffect(() => {
    const handleNavigation = () => setRoute(window.location.pathname)
    window.addEventListener('popstate', handleNavigation)
    return () => window.removeEventListener('popstate', handleNavigation)
  }, [])
  useEffect(() => {
    if (!supabase) return
    let active = true
    const applyUser = async (userId: string | null) => {
      if (!active) return
      setAuthUserId(userId)
      if (!userId) { setProfile(null); setBackendLoading(false); return }
      try { setProfile(await getProfile(userId)); setBackendError('') }
      catch (cause) { setBackendError(cause instanceof Error ? cause.message : 'Profil inaccessible.') }
      finally { setBackendLoading(false) }
    }
    void supabase.auth.getSession().then(({ data }) => applyUser(data.session?.user.id ?? null))
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { void applyUser(session?.user.id ?? null) })
    return () => { active = false; listener.subscription.unsubscribe() }
  }, [])
  useEffect(() => { if (profile) void refreshWorkspace() }, [profile])

  if (route !== '/app') return <Onboarding onDone={enterApp}/>
  if (isSupabaseConfigured && backendLoading) return <main className="loading-screen"><Brand/><span>Ouverture de votre session…</span></main>
  if (isSupabaseConfigured && !authUserId) return <Onboarding onDone={enterApp}/>
  if (isSupabaseConfigured && authUserId && !profile) return <ProfileSetup userId={authUserId} onCreated={setProfile}/>
  if (!isSupabaseConfigured && !onboarded) return <Onboarding onDone={enterApp}/>

  return <div className="app-shell">
    <aside className={`sidebar ${menuOpen ? 'open' : ''}`}>
      <div className="sidebar-top"><Brand/><button onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"><X/></button></div>
      <nav>{navItems.map(({ id, label, icon: Icon }) => <button key={id} className={view === id ? 'active' : ''} onClick={() => setView(id)}><Icon size={20}/><span>{label}</span>{id === 'matches' && matches.length > 0 && <b>{matches.length}</b>}</button>)}</nav>
      <div className="sidebar-account"><div className="avatar small">{profile?.adult_alias[0] ?? 'B'}</div><div><strong>{profile?.adult_alias ?? 'Bruno M.'}</strong><span>Compte parent · {profile?.commune ?? 'Démo'}</span></div><button onClick={handleSignOut} aria-label="Se déconnecter"><LogOut size={17}/></button></div>
    </aside>
    {menuOpen && <button className="nav-scrim" onClick={() => setMenuOpen(false)} aria-label="Fermer le menu"/>}
    <main className="app-main">
      <header className="app-header"><button className="menu-button" onClick={() => setMenuOpen(true)}><Menu/></button><Brand compact/><div><span className="demo-badge">{isSupabaseConfigured ? 'En ligne' : 'Mode démo'}</span><button className="notification-button" aria-label="Notifications"><Bell size={20}/>{(exchanges.some((item) => item.status === 'propose') || matchNotifications.length > 0) && <i/>}</button></div></header>
      {backendError && <div className="backend-alert" role="alert"><Info size={16}/>{backendError}<button onClick={() => setBackendError('')}><X size={15}/></button></div>}
      {matchNotifications.length > 0 && <div className="match-notification-panel" role="status">
        <Bell size={18}/>
        <div><strong>{matchNotifications.length} nouvelle{matchNotifications.length > 1 ? 's' : ''} correspondance{matchNotifications.length > 1 ? 's' : ''}</strong><p>{matchNotifications.slice(0, 2).map((item) => `${item.adultAlias} (${item.commune}) : ${item.gives.slice(0, 3).join(', ')}`).join(' · ')}</p></div>
        <button onClick={() => void dismissMatchNotifications(true)}>Voir</button>
        <button className="icon-button" onClick={() => void dismissMatchNotifications()} aria-label="Masquer les notifications"><X size={15}/></button>
      </div>}
      <AnimatePresence mode="wait">
        {view === 'inventaire' && <InventoryView key="inventory" inventory={inventory} setInventory={setInventory} matchCount={matches.length}/>} 
        {view === 'matches' && <MatchesView key="matches" matches={matches} onPropose={setProposal}/>} 
        {view === 'echanges' && <ExchangesView key="exchanges" exchanges={exchanges} updateExchange={updateExchange}/>} 
        {view === 'securite' && <SafetyView key="safety" matchNotificationsEnabled={profile?.match_notifications_enabled ?? false} onToggleMatchNotifications={toggleMatchNotifications} onReset={reset}/>} 
      </AnimatePresence>
    </main>
    <AnimatePresence>{proposal && <ProposalModal match={proposal} venues={runtimeVenues} onClose={() => setProposal(null)} onConfirm={addExchange}/>}</AnimatePresence>
  </div>
}

