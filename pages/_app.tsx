import GlobalStyle from "@/src/styled/GlobalStyle";
import ThemeProvider from "@/src/styled/ThemeProvide";
import type { AppProps } from "next/app";
import "reflect-metadata"

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ThemeProvider>
      <GlobalStyle />
      <Component {...pageProps} />
    </ThemeProvider>
  );
}

export default MyApp;
