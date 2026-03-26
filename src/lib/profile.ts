export function defaultDisplayName(email: string) {
  const local = email.split("@")[0]?.trim();

  if (!local) {
    return "Gamer_Pro_99";
  }

  return local.length > 20 ? local.slice(0, 20) : local;
}

export function defaultBio() {
  return "Dodaj swój biogram, aby inni gracze wiedzieli, z kim grają.";
}
