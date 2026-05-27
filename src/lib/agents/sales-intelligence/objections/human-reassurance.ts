import "server-only";

import type { ObjectionKind } from "./objection-detector";

/** Lignes de consigne : rassurer comme vendeur de boutique, pas support FAQ. */
export function formatHumanReassuranceGuidance(kind: ObjectionKind | null, lang: "fr" | "en" | "es"): string[] {
  if (!kind) return [];

  if (lang === "en") {
    const map: Record<ObjectionKind, string[]> = {
      price: [
        "Price objection: answer with value (what’s included) + one simple option (step down / bundle) — no corporate lists.",
        "Tone: calm seller. Example shape: “Fair — for this model you’re paying for X. If budget is tight, we also have Y.”",
      ],
      trust: [
        "Trust objection: short proof + process (check before shipping, tracking) — not “as an AI”.",
        "Example shape: “Totally fair to ask — we always verify before shipping. If you want, I’ll send the reference step.”",
      ],
      delivery: [
        "Delivery worry: confirm realistic window + what you control (packing, carrier handoff) — one concrete sentence.",
        "Example shape: “Yes — we double-check before it leaves. For today’s runs, I’ll confirm the slot with you.”",
      ],
      quality: [
        "Quality doubt: specific reassurance (origin, warranty, what you check) — no buzzwords.",
        "Example shape: “It’s a model that moves a lot right now — we inspect each pair before it goes out.”",
      ],
      thinking_time: [
        "They need time: give space, one helpful anchor (size/stock), no pressure stack.",
        "Example shape: “Take your time — when you’re ready, tell me the size and I’ll hold it if still available.”",
      ],
      competitor_compare: [
        "Comparison: highlight differentiator you can stand behind (speed, authenticity, local service).",
        "Example shape: “Online can look cheaper — difference is what we verify here before it leaves.”",
      ],
    };
    return map[kind];
  }

  if (lang === "es") {
    const map: Record<ObjectionKind, string[]> = {
      price: [
        "Precio: responda con valor concreto y una opción simple — sin soporte tipo FAQ.",
        "Estilo vendedor: “Tiene razón — en este modelo paga más por X; si va justo el presupuesto, tenemos también Y.”",
      ],
      trust: [
        "Confianza: prueba corta + proceso verificable antes de enviar.",
        '"Le entiendo — siempre revisamos antes de enviar".',
      ],
      delivery: [
        "Entrega: ventana realista + lo que sí controlamos (embalar, despacho).",
      ],
      quality: [
        "Calidad: origen / control — sin eslóganes.",
        '"Es un modelo que se mueve mucho ahora; revisamos cada unidad antes de salir".',
      ],
      thinking_time: [
        "Necesita tiempo: corto respetuoso — una útil línea sobre talla/disponibilidad.",
      ],
      competitor_compare: [
        "Comparativa: diferenciador defendible — servicio local, verificación, rapidez real.",
      ],
    };
    return map[kind];
  }

  const mapFr: Record<ObjectionKind, string[]> = {
    price: [
      "Objectif prix : répondre comme en boutique — valeur incluse + une alternative simple si budget serré (sans liste corporate).",
      "Exemple de forme (pas à copier mot pour mot) : « Oui Monsieur — sur ce modèle vous payez surtout pour X ; si vous voulez un peu plus serré, on a aussi Y. »",
    ],
    trust: [
      "Méfiance : preuve courte + geste contrôlé (vérif avant expédition, suivi). Pas de ton « assistant ».",
      "Exemple : « Oui Monsieur — on vérifie toujours avant livraison. »",
    ],
    delivery: [
      "Crainte livraison : délai crédible + ce que vous maîtrisez (contrôle avant envoi, transport).",
      "Exemple : « On contrôle bien avant départ si vous préférez. »",
    ],
    quality: [
      "Doute qualité : fait concret (contrôle réel).",
      "Exemple : « C’est un modèle qui part beaucoup actuellement — on vérifie unité par unité. »",
    ],
    thinking_time: [
      "Besoin de réflexion : respecter — une seule aide concrète (taille réf/stock).",
      "Pas enchaîner trois relances dans le même message.",
    ],
    competitor_compare: [
      "Concurrence : un vrai différentiateur défendable — service local / rapidité réelle / vérifié avant envoi.",
    ],
  };
  return mapFr[kind];
}
