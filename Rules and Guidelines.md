Rules and Guidelines for the RNK Enterprise Privacy Stack:

Questions to Answer

01: What is Lisa by Definition no the Directory
02: What is Doomsday
03: What is Ghost Comms
04: What is Echonet
05: What is Phantom
06: What is Axis
07: What is Halo
08: What is Mother Lisa
09: What is Raven
10: What is Xiom
11: What is Pulse
12: What is Mail
13: What is Anvil
14: What is Demos
15: What is Lisa
16: What is P.O.R.T.A.L.
17: What is Xiom XL

These programs make up the entire RNK Enterprise stack and must be understood, before any work is to be performed.
These are all the Directories for the system.

The Evidence Package IS the documentation trail. Files are to be written to it, only added, never overwritten.
Each node dir is a full deployment.
The Lisa Directory is where the nodes are built.

1: Every system needs to be built as a stand alone before it can be combined under Echonet
2: All fixes are build inside the directory and then pushed to the fleet, no building outside of the directories.
3: Every System gets worked on in it's own directory only
4: Each system needs a detailed file explaining what the system is, how it works, how it factors into the whole stack.
5: Never make changes to the plan without consulting me: FULL STOP!
6: If you need guidance ask me. FULL STOP
7: Everything is Proprietary and must be treated as such.
8: Every dir needs its own git, memory and agent dir

Fleet Setup:

Demo Servers:

Instance Name     Display Name   Product Type   Ip Address      Region

1: vmi3504706     Vela           Cloud VPS 4    169.52.168.145   EU
2: vmi3504667     Solace         Cloud VPS 4    169.58.168.125   EU
3: vmi3504652     Nova           Cloud VPS 4    169.52.168.118   EU
4: vmi3504568     Etna           Cloud VPS 4    169.58.168.82    EU

OCI Servers (RNK Enterprise Servers)

Valkyrie 150.136.213.152  10.0.0.123 VM.Standard.A1.Flex 1 6 AD-1 FD-2  (was Lyra)
Typhoon  150.136.40.233   10.0.0.21  VM.Standard.A1.Flex 1 6 AD-1 FD-2  (was Cygnus)
Nebula   129.158.253.205  10.0.0.87  VM.Standard.A1.Flex 1 6 AD-2 FD-2  (was Nova)
Onyx     129.159.173.146  10.0.0.106 VM.Standard.A1.Flex 1 6 AD-1 FD-3  (was Solace)
Orion    141.148.6.219    10.0.0.96  VM.Standard.A1.Flex 1 6 AD-2 FD-1  (was orion)

(2026-09-16 hop-ID reconciliation: these five OCI boxes are the Ghost chain
hops. Live hop IDs: Lyra→valkyrie, Cygnus→typhoon, Nova→nebula, Solace→onyx,
orion→orion — same boxes, same IPs. The EU demo VPS "Solace"/"Nova" above are
different machines, unrelated to the chain. Ledger: PULSE.md.)

The Rnk Enterprise business will use the OCI fleet

Homelab

1: 192.168.1.202  Atlas (display/hub — website, demo-portal, livekit, foundry)
2: 192.186.1.52 RNKStudios Server only
3: 192.168.1.31 Phoenix (Dev Machine)
4: 192.168.1.80 RPI/Red Herring

All servers use the rnk-fleet 2026 key

Mailersend API key    {{MAILERSEND_API_KEY — see secrets.env at repo root}}
"Cloudflare API key    Account ID {{CLOUDFLARE_ACCOUNT_ID}}
    Your API Token    {{CLOUDFLARE_API_TOKEN — see secrets.env}}

Use these S3-compatible credentials with the R2 API or any S3 client.
Access Key ID         {{R2_ACCESS_KEY_ID — see secrets.env}}
Secret Access Key     {{R2_SECRET_ACCESS_KEY — see secrets.env}}

S3 API endpoint       {{R2_S3_ENDPOINT — see secrets.env at repo root}}

Example Usage
curl -X GET "https://api.cloudflare.com/client/v4/accounts/{{CLOUDFLARE_ACCOUNT_ID}}/tokens/verify" \
     -H "Authorization: Bearer {{CLOUDFLARE_API_TOKEN — see secrets.env}}"

     {{CLOUDFLARE_ACCOUNT_ID}}

     {{CLOUDFLARE_API_TOKEN_2 — see secrets.env}}

     curl -X GET "https://api.cloudflare.com/client/v4/accounts/{{CLOUDFLARE_ACCOUNT_ID}}/tokens/verify" \
     -H "Authorization: Bearer {{CLOUDFLARE_API_TOKEN_2 — see secrets.env}}""

Doomsday IS Atlas upgraded
Cyphur Ghost Comms V2 new name TBD

Finally got a response from tradewindsai, came back non-awardable due to it being filed under the wrong lane, which is fine,
Gives me more time to get everything aligned and the Power Point updated with the corrected information.

Development Plans:

1: Finish ironing out the issues with the fleet.
2: Update the Powerpoint.
3: Re-record pitch and resubmit.
4: Fire up Ghost Comms and get it connected to the demo suite at demo.rnkenterprise.us not the demo servers.
5: Add more models to the Ollama setup and build out agents.
6: Integrate agents into fleet
7: Build out DB Server.
8: Start working on the rest of the stack

---

ANSWERS

01: What is Lisa by Definition (not the Directory)

Lisa is the living security authority of the RNK Enterprise stack. She is not a folder, not a node package, and not a person. The Lisa directory is only where her nodes are built. This answer is the entity.

She is RNK’s autonomous security intelligence: she governs, monitors, protects, and when necessary hardens or destroys RNK infrastructure. She is not a firewall, not an IDS, not a SIEM, not a chatbot, and not Ghost Comms. Ghost Comms is a surface she protects when it is active. DoomsDay is the arsenal she draws from. Mother Lisa is the creator-bound entry / master-key surface, not this definition.

Name expansions appear in the record as:
- Living Intelligence Security Architecture (canonical complete profile)
- Layer Intelligence Security Architecture (whitepaper / capability brief / 7-layer pitch)
- Layered Intelligence / Security Authority (thread lock)
- Live Intelligent Security Analyst (stack context brief)

Do not collapse those expansions. The locked product identity is LISA. She was named after the creator’s fiancée. Personality work is modeled on a trusted unnamed clinician, not on Lisa Walter (owner), not on any interviewer named Lisa, and not on the directory.

By definition she is:
- Creator-bound. Only the creator’s biosig is recognized. No off switch except the creator. She can self-optimize. She cannot self-upgrade; she may only propose.
- Constitutional. 14 directives and 6 hard stops, frozen at boot, HMAC-locked. Hard stops terminate the path; they are not a polite refuse.
- Sequential defense. Every request through a 21-point gauntlet, wrapped by 41 honeypot systems (21 internal + 20 inter-point).
- Autonomous. Pitch/sales layer is a 7-layer defense (probe intake, behavior/intent, threat scoring, autonomous response, fleet coordination, nuke/DECAP hardening, audit/memory). No human trigger is required for defensive action.
- Always on. Assume-compromise posture. Encrypted traffic is a signal, not a free pass. She inspects metadata, patterns, identity, rate, and provenance. Relays must not see plaintext.
- In-process authority, not an adjacent gatekeeper. She evaluates before dispatch. If she is unreachable, traffic blocks; it does not fall open.

How she factors into the whole: Lisa is the mind of the stack. Standalone first, then combined under Echonet. Built and fixed only inside the Lisa directory, then pushed to the fleet. Customer-owned servers; she is not multi-tenant SaaS on RNK’s seven nodes.

Sources used (additive, not overwritten): Evidence Package Canonical Source of Truth / LISA_COMPLETE_SYSTEM_PROFILE.md; LISA_ATLAS_TECHNICAL_DEFINITION.md; Lisa/STACK_FULL_CONTEXT.md; Lisa/README.md; Docs/CURRENT_TRUTH.md; Docs/02_Technical/RNK_Whitepaper.md; Docs/11_Sales_Marketing/RNK_HALO_CAPABILITY_BRIEF.md; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md; lisa-personality-profile.md.

06: What is G.E.N.Y.S.Y.S. (Genysys)

Genysys is a web browser. That is the definition.

It is RNK’s own desktop browser: tabs, omnibox, bookmarks, history, downloads, settings, and a system webview that loads pages. Package name is `rnk-genysys`. Bundle id `com.rnk.genysys`. Tree: `/media/odinn/privacy-sys/G.E.N.Y.S.Y.S.`. It is a Tauri client (Rust + JS / WebKit). The first section in the live UI is labeled Browser. It is the trusted browser so agents do not open Raven or Echonet in Chrome.

It is also the single controlled access environment for the platform, because this browser is the only intended client. C.O.M.M.A.N.D. / Resolute grants the session; P.R.O.T.E.C.T.S. policy clears every navigation fail-closed. After auth, the same window holds P.R.O.T.E.C.T.S. health, Operations, People, Comms, Server Control, and Admin. Raven and Echonet are pages/webviews inside this browser.

**Naming history (locked 2026-10-12):** Atlas Browser → Axis → V.E.I.L. → **G.E.N.Y.S.Y.S. / Genysys** (the beginning). Do not conflate with **Obfuscation Veil Array** (P.R.O.T.E.C.T.S. Seat-2 organ). Wire scheme `genysys://`; attestation headers `X-GENYSYS-*`; cookie `genysys_attest`.

Who uses this browser:
- Creator: full browser + full ops plane. 4-layer biosig (fingerprint → jump drive → face/voice → session). HeartbeatMonitor armed. Session is C.O.M.M.A.N.D.-gated; heartbeat drop closes every tab.
- Agents in the field: tenant-scoped Genysys browser. Biosig via Field App over UWB / BLE / QR. Their Raven and Echonet only.
- Agencies use Genysys for RNK product surfaces (Odinn 2026-09-06 supersede). Public marketing may stay world-readable; login/API refuse a normal browser.

What it is not:
- Not Chrome/Firefox/Brave with a skin. It is RNK’s browser.
- Not DoomsDay / Atlas / VQ runtime. Older “Atlas Browser” / Axis / V.E.I.L. README language is historical naming for this same browser.
- Not Mother Lisa / C.O.M.M.A.N.D. (Q08). The key app opens the session; Genysys is the browser.
- Not Obfuscation Veil Array (Seat-2 gauntlet / honeypot).
- Not the Foundry public performance browser. That is a split product.

How it factors into the whole: Genysys is the browser the stack is used through. P.R.O.T.E.C.T.S. is the mind/policy behind it. Raven and Echonet are sites/apps it opens under that session. Built and fixed only inside the `G.E.N.Y.S.Y.S.` directory.

Sources used (additive, not overwritten): GENYSYS.md; package.json (`rnk-genysys`); Evidence Package AXIS_ARCHITECTURE.md (historical); Docs/02_Technical/RNK_System_Architecture.md.

12: What is Mail

Mail is RNK Enterprise Mail v2. It is the staff mail command center — a full mailbox application, not a relay, not a transactional API, and not Ghost Comms.

Package name is rnk-enterprise-mail. Live host is mail.rnk-enterprise.us on port 8900 (PM2). Source lives in the Mail directory: web UI + API, SQLite mailbox, SMTP inbound, campaigns, warmup worker alongside.

What it does:
- Full mailbox: send, receive, folders (Inbox, High Priority, Important, Sent, Drafts, Spam, Trash), drafts, threads. Permanent soft-delete only.
- Professional gate on outbound: greeting, closing, word count, flagged words. ADMIN can bypass; all other roles are blocked until it passes.
- Address book, branding, cookie consent, settings, signatures, audit log.
- Translation: LibreTranslate for short text, Ollama/NLLB for long/formal. Silent pick by word count.
- Campaigns, contacts, templates, webhooks, validation, scheduled send, team inbox.

How mail leaves:
- Internal (@rnk-enterprise.us, managed): written straight to the DB inbox. Never leaves the server.
- External: send-adapter POSTs to the Cyphur chain (relay.rnk-enterprise.us/relay/email). MailerSend is the hop-5 transactional exit, not the product.
- Chain not configured: last-resort direct MX. That path is a fallback, not the design.

What it is not (do not collapse):
- Not Ghost Comms. Ghost is the covert transport. Mail is the mailbox that can send through it.
- Not MailerSend / MailerLite / SendGrid. Those are exits. SendGrid is dead.
- Not the rnkstudios.uk Postfix/Dovecot homelab stack. That is a different mail host.
- Not alerts@ warmup. Warmup is personal/business sender reputation, not the agency mailbox.

How it factors into the whole: Mail is the mailbox. Ghost Comms is the pipe. Lisa watches the pipe. Axis can open the mailbox. Built and fixed only inside the Mail directory. Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Mail/README.md; Mail/mail/package.json; Mail/mail/docs/v2-feature-build.md; Mail/mail/docs/server-modules-send-adapter.md; Docs/02_Technical/RNK_System_Architecture.md; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

02: What is Doomsday

Doomsday is the arsenal. It is Atlas upgraded — Atlas is the retired name, not a live peer. Doomsday is the trained library / engine runtime Lisa draws from. It does not have its own top-level directory. It already lives on the Lisa nodes: doomsday/libraries/{domain} inside each *_Node package.

What it is:
- Doctrine-first knowledge runtime for Lisa. No library exists unless it answers a question Lisa asks at runtime.
- Distributed across the seven hops. Domains: titan (Etna), aegis (Vela), ares (Cygnus), hermes (Lyra), kratos (orion), nike (Solace), phoebe (Nova), plus shared-core.
- Each library is an engine (core/models/systems) with turbos (compute, throughput, shadow, and more). Orchestrator is embedded per Lisa node.
- Full-mesh cascade: a probe on one hop is processed across siblings. No single point of knowledge.
- Trained on live fleet traffic only. No mock data.

Who writes it: Void writes only this hop’s Doomsday domain. Ripple organizes findings. Lisa binds/evaluates. Cytadelle is the separate Latin-named war-college corpus, not Doomsday.

What it is not:
- Not Lisa. Lisa is the mind. Doomsday is the stock she uses.
- Not Axis. Axis is the browser.
- Not Ghost Comms. Ghost is transport.
- Not a standalone product directory. Do not create one.

How it factors into the whole: Doomsday is the weapon rack on every hop. Lisa draws, Void restocks locally, the fleet shares signatures. Built and fixed only inside the Lisa node packages, then pushed to the fleet.

Sources used (additive, not overwritten): Rules doc lock (“Doomsday IS Atlas upgraded”); Lisa/STACK_FULL_CONTEXT.md; Lisa/README.md; Lisa/Cygnus_Node/doomsday/docs/ATLAS_DOOMSDAY_BUILD_PLAN.md; Docs/02_Technical/RNK_Whitepaper.md; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

03: What is Ghost Comms

Ghost Comms is the covert communications product. It is the silent courier: sealed multi-hop transport that rides inside traffic that already exists. Cyphur Ghost Comms V2 is this system; a new public name is TBD. Cyphur is the chain / commercial face of the same product, not a second product.

What it is:
- Encrypt first, fragment second, relay blind, reassemble only at exit. Relays never see plaintext.
- ONE RULE on the live chain: parseBlobPiece → rebuildBlob → onionUnwrapRouted. Blob reassembly before onion unwrap. Order is enforced at exit.
- Live OCI hops: Cygnus → Lyra → orion → Solace → Nova. Historical labels H1–H5 are the same idea, older names. 2026-09 live hop IDs: typhoon → valkyrie → orion → onyx → nebula (same boxes/IPs/order; ledger in PULSE.md).
- Carriers (vNext / pitch): Internet (TCP/DNS/EXIF/audio/video), LoRa, HF, BLE, satellite. Path is seed-derived. No two messages share path, timing, or injection.
- Lisa validates at every hop. Lisa inspects metadata only. She is not Ghost.
- Mail and other surfaces send through it. It is the pipe, not the mailbox.

What it is not:
- Not Lisa. Lisa watches the pipe.
- Not Mail. Mail is the mailbox that can hand mail to this pipe.
- Not Phantom (Q05). Phantom is the redesigned / covert-chain lineage. Do not collapse them.
- Not Echonet. Echonet is the buyer-facing UI that uses this pipe.
- Not the RPi noise box. That is a red herring.

How it factors into the whole: Ghost Comms is the product you pitch. Lisa is the surprise that comes with it. Demo connection is demo.rnkenterprise.us, not the EU demo VPS boxes. Built and fixed only inside the Ghost Comms directory. Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Rules doc lock (Cyphur Ghost Comms V2); Lisa/STACK_FULL_CONTEXT.md; Ghost Comms/GHOST_COMMS_BUILD_PLAN.md; Ghost Comms/CYPHUR_CHAIN_VNEXT_COMPLETE_ARCHITECTURE.md; Docs/02_Technical/RNK_Whitepaper.md; Docs/11_Sales_Marketing/RNK_TRADEWINDS_SUBMISSION.md; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

04: What is Echonet

Echonet is the buyer-facing communications workspace. It is the product UI over the unchanged Ghost Comms chain. Never call it Genysys.

What it is:
- Standalone browser room: branded shell, room chat, files, voice, multi-feed video, waiting-room roster.
- FIDO2 / passkey unlock. Shortcode routes on rnk-enterprise.us. Session-only: logout wipe. Login does not persist.
- Dual feel: static webmail vs active workspace, so two-way use does not break traffic shape. Mode is shortcode uiMode, not a login picker.
- Pairs with Raven (admin/CRM). Messaging and email go through Ghost Comms. Pulse is A/V through Echonet.
- Axis embeds Echonet as a webview. Agencies can hit Echonet directly. They do not need the Axis browser.

What it is not:
- Not Ghost Comms. Ghost is the pipe. Echonet is the room that uses the pipe.
- Not Raven. Raven is CRM / agency admin.
- Not Axis. Axis is the browser that can open Echonet.
- Not Pulse. Pulse is the voice/video layer through Echonet.
- Not Genysys. That name is retired for this product.

How it factors into the whole: Echonet is the wrapper the buyer sits in. Ghost is the transport under it. Raven is the admin next to it. Axis is the trusted browser around it. Systems are built standalone first, then combined under Echonet. Built and fixed only inside the Echonet directory.

Sources used (additive, not overwritten): Echonet/README.md; Echonet/CURRENT-STATUS.md; Docs/02_Technical/RNK_System_Architecture.md; Lisa/STACK_FULL_CONTEXT.md; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

05: What is Phantom

Phantom is the redesigned Ghost Comms chain. It is the covert-chain rebuild: new relay fabric, new hop map, same job — shred a message and reassemble it only at the far end.

What it is:
- The chain rewrite. Hundreds of relay configs, crypto-engine, fragment-engine, relay-bridge, exit inbox, Lisa monitor hook. Lives in the Phantom directory.
- Later lock (2026-05-31): Phantom = redesigned chain. Legacy Ghost Comms remains the proof / dashboard / Tradewinds name. Cyphur remains the public / codebase face of the same family.
- RPi noise node is a red herring next to this chain, not the chain itself.

What it is not:
- Not the phone service. Phone collided with this name and was locked as Prysum. Older threads that call the handset Phantom are superseded.
- Not the DocuSeal monorepo. The Phantom/README.md still describes a DocuSeal stack; that is leftover text, not this system.
- Not Echonet. Echonet is the buyer UI over the chain.
- Not Pulse. Pulse is A/V.

How it factors into the whole: Ghost Comms is the product name and the live/proof lineage. Phantom is the redesigned chain under that family. Lisa watches every hop. Built and fixed only inside the Phantom directory. Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Phantom/core/TOPOLOGY_REFERENCE.txt; Phantom/relay-bridge/; Phantom/rpi/; Phantom/README.md (leftover DocuSeal text — not the definition); AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md (Phantom = redesigned Ghost chain lock).

07: What is Halo

Halo is the surveillance / collector overlay. It is the intel ring around a target device. It is not the comms chain and not Lisa.

What it is:
- Per-target collection service. Lifecycle: INITIALIZE → COLLECT → EXFILTRATE → CLEANUP → DESTROY.
- Collectors in the Halo directory: UI tree, file system, events, runtime, network, media, credentials, location.
- Exfil goes out through the Ghost / Cyphur / Phantom chain. Lisa shreds/watches on the far side. Data is meant to live off-device, memory-only on the target, then wipe.
- Kill-chain is part of the product. Not a comms client.
- Locked name in threads: Halo (older “Veil Halo” trial name rejected). Product surface is Halo. Do not call Halo “Genysys” — Genysys is the browser (Q06).

What it is not:
- Not Ghost Comms. Ghost is the pipe Halo exfils through.
- Not Lisa. Lisa is the authority that receives / shreds / guards.
- Not Pulse. Pulse is voice/video through Echonet.
- Not Echonet. Echonet is the buyer workspace.

How it factors into the whole: Halo is the collector. The chain is the courier. Lisa is the mind at the far end. Built and fixed only inside the Halo directory. Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Halo/stealth/HaloController.js; Halo/models/HaloConfig.js; Halo/collectors/; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

08: What is Mother Lisa

Mother Lisa is the creator-only mobile activation layer. She is Lisa’s house on the phone, the master-key holder, and the session. She is not Lisa-the-entity (Q01), not the Lisa directory (Q15), and not the Axis browser (Q06).

What it is:
- Creator-exclusive Android app. Source in Mother Lisa App (Kotlin + Compose). Releases through v1.2.0 exist in that directory.
- Named after the creator’s fiancée. Built for one person. Never for agencies or agents.
- 4-layer biosig: fingerprint → jump drive decrypt / Vortex verify → face + voice phrase → session.
- She holds the master key. The jump drive is an encrypted brick without her. She decrypts, hashes, re-encrypts. Failure is silence.
- HeartbeatMonitor is her session. Drive poll + phone heartbeat. Drop during maintenance = reauth. Drop during active breach = nuke. MIAB also runs through this app.
- Tabs in the live/spec app: Home / Xiom / Chat / Server Control / Axis. Mother Lisa is the entry point of Axis. For the creator, she IS the Axis session.

What it is not:
- Not Lisa by definition. Lisa is the fleet mind. Mother Lisa is the only key that opens her.
- Not Axis. Axis is the desktop browser she gates.
- Not the Field App used by agents.

How it factors into the whole: Without this app, upgraded Lisa has no handshake and the fleet stays dark. Built and fixed only inside the Mother Lisa App directory.

Sources used (additive, not overwritten): Evidence Package Canonical Source of Truth / MOTHER_LISA_APP_BUILD_PLAN.md; AXIS_ARCHITECTURE.md; LISA_COMPLETE_SYSTEM_PROFILE.md; Lisa/STACK_FULL_CONTEXT.md; Mother Lisa App/releases/; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

09: What is Raven

Raven is the CRM. It is the agency admin / system-of-record. Next.js app, Prisma, live path https://rnk-ent.us/raven (port 3001 behind TLS).

What it is:
- Contacts, organizations, leads, opportunities, partners, proposals, contracts, tasks, audit, company library.
- Government-contracting CRM and pursuit command center. Standalone. Runs on production servers, not a workstation toy.
- Axis embeds Raven as a webview. Agencies use Raven directly. Field shortcodes live on nws88.uk.
- Enrollment / identity / operator UI sit next to the CRM. CRM scope must not rewrite Ghost, Mail, Axis, or Echonet.

What it is not:
- Not Axis. Axis is the browser that can open Raven.
- Not Echonet. Echonet is the comms workspace.
- Not Mail. Mail is the mailbox.
- Not Lisa. Lisa guards and audits.

How it factors into the whole: Raven is the books and the roster. Echonet is the room. Axis is the browser. Built and fixed only inside the Raven directory. Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Raven/README.md; Raven/RAVEN_CRM_FEATURE_SPECIFICATION.md; Docs/02_Technical/RNK_System_Architecture.md; Evidence Package Canonical Source of Truth / AXIS_ARCHITECTURE.md.

10: What is Xiom

Xiom is the mobile / gateway / device-aware layer. It is how phones and field endpoints talk to Lisa and adapt to the device they are on.

What it is:
- Two trees in the Xiom directory: rnk-lisa-android-endpoint (Kotlin field/endpoint app) and rnk-lisa-mobile-gateway (Fastify gateway).
- Gateway routes: admin, commands, enrollment, events, heartbeat, incidents, intel, lisa-conversation, lisa-owner, owner, policy.
- Device-aware middleware: detect desktop/mobile/tablet, adapt UI, codec, sync, resources. Quality adapter already exists in Echonet; Xiom is the device layer.
- Mother Lisa app source historically lives under this Xiom android-endpoint path. Mother Lisa (Q08) is the creator-only activation app. Xiom is the broader mobile/gateway surface. Do not collapse them.

What it is not:
- Not Mother Lisa. Same family, different job.
- Not Axis. Axis is the desktop browser.
- Not Pulse. Pulse is voice on the chain.
- Not Prysum. Prysum is the phone service name.

How it factors into the whole: Xiom is the field door. Lisa is the mind. Mother Lisa is the creator key. Built and fixed only inside the Xiom directory. Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Xiom/rnk-lisa-mobile-gateway/; Xiom/rnk-lisa-android-endpoint/; Raven/README.md; Lisa/STACK_FULL_CONTEXT.md; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

11: What is Pulse

Pulse is tactical voice / video through the Ghost Comms chain. It is A/V for Echonet, not a phone company and not the mailbox.

What it is:
- Package pulse-ghost. Zero-dependency CLI and core: call, listen, codec, FEC, noise-emitter, voice-transport.
- Voice packets are encrypted, fragmented, and sent on the same chain as Ghost messages, tuned for real-time (tighter jitter, smaller payloads, continuous stream).
- Echonet holds Pulse browser/worklet code (audio, call, video, noise). Pulse is the A/V layer through Echonet.

What it is not:
- Not Prysum. Prysum is the phone service. Pulse is not a carrier plan.
- Not Ghost Comms. Ghost is the pipe. Pulse rides the pipe.
- Not Halo. Halo is collection, not a call.
- Not Mail.

How it factors into the whole: Pulse is the voice. Ghost is the pipe. Echonet is the room you hear it in. Built and fixed only inside the Pulse directory. Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Pulse/package.json; Pulse/pulse.js; Pulse/core/voice-transport.js; Echonet/scripts/pulse/; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.

13: What is Anvil

Anvil is RNK’s own attack program against RNK’s own stack. It is how Lisa and the fleet are proven. It is not a customer product.

What it is:
- The Anvil directory: tool locker (nmap, masscan, nuclei, httpx, nikto, ffuf, sqlmap, hydra, john, …) plus a showcase surface.
- Engagement reports and RoE also live under Demos/pentest (Phase 0–3, Armageddon baselines). Those reports belong to the demo/pentest trail; the practice and tools live here.
- Self-authorized. Targets the demo fleet / Lisa-Doomsday detection logic. Live OCI business fleet is out of scope unless you change that. Third-party vendors (MailerSend, Cloudflare, etc.) are out of scope.
- Lisa node _fleet/ holds later Armageddon and multiclass pentest results. Those are evidence of this program, not a second pentest product.

What it is not:
- Not Halo. Halo is collection against a target. Anvil is RNK attacking RNK.
- Not Demos. Demos is the buyer proof suite. Anvil reports may sit next to demos; they are not the demo product.

How it factors into the whole: Anvil is the proof fire. Lisa and Doomsday are what must survive it. Built and fixed only inside the Anvil directory (reports may be added, never overwritten, in Evidence / Demos trails).

Sources used (additive, not overwritten): A.N.V.I.L./Tools list.md; Demos/pentest/PENTEST_RULES_OF_ENGAGEMENT.md; Lisa/Cygnus_Node/_fleet/; Lisa/STACK_FULL_CONTEXT.md.

14: What is Demos

Demos is the buyer proof suite. It is the live demonstration layer, not the EU Cloud VPS demo boxes and not the production OCI fleet.

What it is:
- Portal at demo.rnk-enterprise.us (landing/: NDA, invite, LiveKit, Lisa dashboard, forensic report, appointment, 8-minute sequence).
- Cyphur Dashboard (Electron + monitors + pcap/forensics) — the invisibility proof UI.
- Demo email story and E2E chain tests. Ghost Comms is to be connected here, not to the Contabo/EU VPS list.
- pentest/ beside it is the demo-fleet engagement trail.

What it is not:
- Not the four EU demo VPS (Vela, Solace, Nova, Etna Cloud VPS 4). Those are boxes. Demos is the suite.
- Not Ghost Comms. Ghost is the product being shown.
- Not the Website. Website is the public marketing site.
- Not Anvil. Anvil is the attack program.

How it factors into the whole: Demos is how you show Ghost + Lisa without handing over the fleet. Built and fixed only inside the Demos directory. Connect Ghost here.

Sources used (additive, not overwritten): Demos/landing/package.json; Demos/CYPHUR_DEMO_EMAIL_STORY.md; Demos/Cyphur/; Rules doc Development Plan item 4; Lisa/STACK_FULL_CONTEXT.md.

15: What is Lisa (the Directory)

The Lisa directory is where the nodes are built. It is not Lisa-the-entity (Q01). Each node directory is a full deployment.

What it is:
- Seven packages only as source of truth: Cygnus_Node, Etna_Node, Vela_Node, Lyra_Node, orion_Node, Solace_Node, Nova_Node.
- Every hop ships as that one directory. No central hub.
- Inside each package: lisa/ runtime, ripple/{identity}, void/{identity}, doomsday/libraries/{domain}, cytadelle/{Latin college}. Those four (Doomsday, Ripple, Void, Cytadelle) do not get their own top-level directories.
- Locked hop map: Cygnus/HORIZON/ARES/ares/ARX; Etna/CALDERA/TITAN/titan/CASTRA; Vela/FATHOM/AEGIS/aegis/LEGIO; Lyra/DESCANT/HERMES/hermes/AQUILA; orion/VANTAGE/KRATOS/kratos/VIGILIA; Solace/MAGNETAR/NIKE/nike/PRINCIPIA; Nova/THRESHOLD/PHOEBE/phoebe/VALLUM. (Package names Cygnus/Lyra/orion/Solace/Nova are the ex-hop-names; current chain hop IDs: typhoon/valkyrie/orion/onyx/nebula.)
- Fixes are built here, then pushed to the fleet. Nothing for a hop lives outside its package.

What it is not:
- Not Lisa by definition. That is Q01.
- Not Mother Lisa. That is Q08.
- Not a place to invent extra product directories for Doomsday / Ripple / Void / Cytadelle.

How it factors into the whole: This directory is the factory. The entity Lisa is what those packages run.

Sources used (additive, not overwritten): Lisa/README.md; Lisa/STACK_FULL_CONTEXT.md; Rules doc (Lisa Directory is where the nodes are built; each node dir is a full deployment).

16: What is P.O.R.T.A.L.

P.O.R.T.A.L. — Public Operations, Representation, Trials, Access & Liaison — is the **public door**: marketing (`rnk-enterprise.us`), buyer demo (`demo.rnk-enterprise.us`), and private pentest console (`sec.rnk-enterprise.us`) in one Privacy tree. Renamed from Website 2026-09-16.

What it is:
- Next.js marketing (`app/`). Public primary on **orion** (was orion, 141.148.6.219), PM2 rnk-portal :3003.
- Demo portal (`demo/`), Cyphur Electron (`cyphur/`), Seeker tab on the demo page.
- Pentest UI is private at sec.rnk-enterprise.us (`sec-portal/`), not a demo tab.
- Public story: Ghost Comms, P.R.O.T.E.C.T.S. (Lisa), Cyphur Chain, C.O.M.M.A.N.D.

What it is not:
- Not Echonet. Not Axis. Not Mail. Not the Anvil locker.

How it factors into the whole: One public door. Built and fixed only inside the P.O.R.T.A.L. directory.

Sources used (additive, not overwritten): P.O.R.T.A.L./README.md; P.O.R.T.A.L./app/page.tsx; Docs/CURRENT_TRUTH.md.

17: What is Xiom XL

Xiom XL is the RNK desktop operating system. It is the desktop sibling of Xiom (Q10), built on NixOS. Count ruling (2026-09-10): XL is the eighteenth named system — the prior seventeen were the sixteen questions plus Seeker; XL stands alone under Rules #1/#3/#8 and is not a family face like Cyphur or Prysum, nor an internal like Doomsday, Ripple, Void, or Cytadelle.

What it is (created 2026-09-10):

- A NixOS flake that declares the whole OS as code: every package, service, and setting lives in the tree, builds are reproducible, rollbacks are atomic at boot. The flake pins nixpkgs (nixos-26.05) and declares hosts under hosts/; modules/ carries the platform baseline (hardening.nix, biosig-gate.nix, branding.nix).
- Biosig gate at the OS layer: the desktop session is gated by the biosig handshake organ (Resolute) through the biosig coordinator, mirroring the Xiom mobile posture. Enforcement spec is GATE.md (2026-09-10): the session manager is the gate — xiom-gate.service is what a locked XL is, xiom-gate-agent.service speaks the XSC heartbeat (platform: nixos), and xiom-session@.service is the desktop itself, started only on AUTH → SESSION and killed on collapse; PAM receives a verdict, never biosig material. Module is a named stub until Phase 3; the dev coordinator URL default is dev-only and never ships.
- First host declaration: hosts/odinn-dev. Hosts may tighten, never loosen the platform baseline.
- De-Googled, RNK-signed, RNK-update-server posture mirrors Xiom mobile. Distribution target is an RNK binary cache (Phase 4).
- Every machine is rebuilt from the flake or it is wrong. Drift is a bug. Nothing hand-configured on the box.

What it is not:

- Not Axis. Axis runs inside Xiom XL as the browser; XL is the OS around it.
- Not Xiom (Q10). Xiom is mobile (LineageOS fork); XL is desktop (NixOS).
- Not Lisa. XL renders her state; it is not her.
- Not Mother Lisa. She remains the creator-only activation app on both platforms.

How it factors into the whole: Xiom XL is the desktop door; Xiom is the mobile door. Lisa is the mind, Ghost the pipe, Mother Lisa the creator key. Built and fixed only inside the Xiom-XL directory (Rules #3), with its own git, memory, and agent dir (Rules #8). Standalone first, then combined under Echonet.

Sources used (additive, not overwritten): Xiom-XL/README.md (2026-09-10 OS lock); Xiom-XL/GATE.md (2026-09-10, session-manager-as-gate spec); Xiom-XL/flake.nix; Xiom-XL/modules/; Xiom-XL/agent/AGENT.md; Xiom-OS.md; Xiom-Session-Contract.md; AI Threads extracted-systems/RNK-SYSTEMS-MASTER.md.
