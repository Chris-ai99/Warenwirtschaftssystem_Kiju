export function createRandomId() {
  const randomUUID = globalThis.crypto?.randomUUID;
  if (typeof randomUUID === "function") {
    return randomUUID.call(globalThis.crypto);
  }

  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (char) => {
    const randomValue = Math.floor(Math.random() * 256);
    return (Number(char) ^ (randomValue & (15 >> (Number(char) / 4)))).toString(16);
  });
}
