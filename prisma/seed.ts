async function main() {
  console.log("Seed pipeline is configured. Add domain-specific seed logic in prisma/seed.ts.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});