import { BlockList, isIP } from "node:net";

// Private, loopback, link-local, CGNAT, benchmark, multicast and reserved ranges.
// IPv4-mapped IPv6 addresses are unwrapped first: a ::ffff:0:0/96 rule in a
// BlockList would also match every plain IPv4 address.
const blocked = new BlockList();
for (const [net, prefix] of [
  ["0.0.0.0", 8],
  ["10.0.0.0", 8],
  ["100.64.0.0", 10],
  ["127.0.0.0", 8],
  ["169.254.0.0", 16],
  ["172.16.0.0", 12],
  ["192.0.0.0", 24],
  ["192.168.0.0", 16],
  ["198.18.0.0", 15],
  ["224.0.0.0", 3],
] as const) {
  blocked.addSubnet(net, prefix, "ipv4");
}
for (const [net, prefix] of [
  ["::", 127],
  ["64:ff9b::", 96],
  ["fc00::", 7],
  ["fe80::", 10],
  ["ff00::", 8],
] as const) {
  blocked.addSubnet(net, prefix, "ipv6");
}

/** True for an address on the public internet; false for anything internal or invalid. */
export function isPublicAddress(address: string): boolean {
  const mapped = address.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/i)?.[1];
  const ip = mapped ?? address;
  const family = isIP(ip);
  if (!family) return false;
  return !blocked.check(ip, family === 4 ? "ipv4" : "ipv6");
}
