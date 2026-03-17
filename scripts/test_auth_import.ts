
console.log("Start");
async function main() {
    console.log("Importing googleapis...");
    await import("googleapis");
    console.log("Imported googleapis.");
    console.log("Importing google-auth...");
    await import("../server/integrations/google-auth");
    console.log("Imported google-auth.");
}
main();
