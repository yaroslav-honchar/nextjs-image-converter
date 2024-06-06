// import "primereact/resources/themes/lara-dark-cyan/theme.css"
import "primeicons/primeicons.css"
import "@/_app/styles/main.scss"

import React from "react"
import type { Metadata } from "next"

export const metadata: Metadata = {
  icons: "/icon.png",
  title: "Convertage",
}

export default function Layout({ children }: React.PropsWithChildren) {
  return children
}
