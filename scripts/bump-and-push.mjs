import { execSync } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import { resolve } from "node:path"

const pkgPath = resolve(process.cwd(), "package.json")
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"))

const parts = String(pkg.version)
  .split(".")
  .map((part) => Number.parseInt(part, 10))

if (parts.length !== 3 || parts.some((part) => !Number.isInteger(part) || part < 0)) {
  console.error(`Некорректная version в package.json: ${pkg.version}`)
  process.exit(1)
}

parts[2] += 1
pkg.version = parts.join(".")
writeFileSync(pkgPath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8")

const message = `v ${pkg.version}`
console.log(`version → ${pkg.version}`)

execSync("git add .", { stdio: "inherit" })
execSync(`git commit -m "${message}"`, { stdio: "inherit" })
execSync("git push", { stdio: "inherit" })
