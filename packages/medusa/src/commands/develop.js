import path from "path"
import { fork, execSync } from "child_process"
import chokidar from "chokidar"

import Logger from "../loaders/logger"

export default async function ({ port, directory }) {
  const args = process.argv
  args.shift()
  args.shift()
  args.shift()

  const babelPath = path.join(directory, "node_modules", ".bin", "babel")

  execSync(`"${babelPath}" src -d dist`, {
    cwd: directory,
    stdio: ["ignore", process.stdout, process.stderr],
  })

  const cliPath = path.join(directory, "node_modules", ".bin", "medusa")
  let child = fork(cliPath, [`start`, ...args], {
    detached: true,
  })

  child.unref()

  chokidar.watch(`${directory}/src`).on("change", (file) => {
    const f = file.split("src")[1]
    Logger.info(`${f} changed: restarting...`)
    child.kill("SIGINT")

    execSync(`${babelPath} src -d dist --extensions \".ts,.js\"`, {
      cwd: directory,
      stdio: ["pipe", process.stdout, process.stderr],
    })

    Logger.info("Rebuilt")

    child = fork(cliPath, [`start`, ...args], {
      detached: true,
    })

    child.unref()
  })
}
