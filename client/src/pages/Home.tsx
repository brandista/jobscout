import { useAuth } from "@/_core/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import DashboardLayout from "@/components/DashboardLayout";
import { Briefcase, TrendingUp, Target, Zap, ArrowRight, User, Bookmark, Bot } from "lucide-react";
import { Link } from "wouter";

export default function Home() {
  const { user, isAuthenticated } = useAuth();

  return (
    <DashboardLayout allowGuest>
    <div className="min-h-screen">
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900">
        <div className="container max-w-6xl py-20 md:py-32">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 rounded-full text-sm font-medium text-blue-900 dark:text-blue-100">
                <Zap className="w-4 h-4" />
                Älykkäät Työpaikka-Haut
              </div>
              
              <h1 className="text-4xl md:text-6xl font-bold leading-tight bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Löydä Unelmatyösi Automaattisesti
              </h1>
              
              <p className="text-lg md:text-xl text-muted-foreground">
                Job Scout Agent etsii sinulle sopivia työpaikkoja älykkään matchaus-algoritmin avulla. 
                Säästä aikaa ja löydä parhaat mahdollisuudet vaivattomasti.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                {isAuthenticated ? (
                  <>
                    <Link href="/scout">
                      <Button size="lg" className="w-full sm:w-auto">
                        <TrendingUp className="w-5 h-5 mr-2" />
                        Aloita Scoutaus
                      </Button>
                    </Link>
                    <Link href="/jobs">
                      <Button size="lg" variant="outline" className="w-full sm:w-auto">
                        Katso Matchit
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  </>
                ) : (
                  <>
                    <Link href="/login">
                      <Button size="lg" className="w-full sm:w-auto">
                        Kirjaudu Sisään
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                    <Button size="lg" variant="outline" className="w-full sm:w-auto">
                      Lue Lisää
                    </Button>
                  </>
                )}
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-purple-400 rounded-3xl blur-3xl opacity-20"></div>
              <Card className="relative border-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Target className="w-6 h-6 text-primary" />
                    Matchaus-Esimerkki
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Taidot</span>
                      <span className="text-sm font-bold text-green-600">95%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: "95%" }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Kokemus</span>
                      <span className="text-sm font-bold text-blue-600">88%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-blue-500 rounded-full" style={{ width: "88%" }}></div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Sijainti</span>
                      <span className="text-sm font-bold text-purple-600">92%</span>
                    </div>
                    <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                      <div className="h-full bg-purple-500 rounded-full" style={{ width: "92%" }}></div>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <div className="flex justify-between items-center">
                      <span className="font-semibold">Kokonaismatch</span>
                      <span className="text-2xl font-bold text-primary">91%</span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="container max-w-6xl">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold mb-4">Miten Se Toimii?</h2>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              Kolme yksinkertaista vaihetta unelmatyöhön
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 rounded-lg flex items-center justify-center mb-4">
                  <User className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <CardTitle>1. Luo Profiili</CardTitle>
                <CardDescription>
                  Kerro itsestäsi, taidoistasi ja siitä, mitä etsit seuraavasta työpaikasta
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-purple-100 dark:bg-purple-900 rounded-lg flex items-center justify-center mb-4">
                  <TrendingUp className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <CardTitle>2. Käynnistä Scoutaus</CardTitle>
                <CardDescription>
                  Agentti etsii automaattisesti sinulle sopivia työpaikkoja useista lähteistä
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="border-2 hover:border-primary transition-colors">
              <CardHeader>
                <div className="w-12 h-12 bg-green-100 dark:bg-green-900 rounded-lg flex items-center justify-center mb-4">
                  <Briefcase className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <CardTitle>3. Selaa Matcheja</CardTitle>
                <CardDescription>
                  Tarkastele työpaikkoja, jotka vastaavat parhaiten profiiliasi ja toiveitasi
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-gradient-to-br from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="container max-w-6xl">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl md:text-4xl font-bold">Miksi Job Scout Agent?</h2>
              
              <div className="space-y-4">
                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Zap className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Älykkäät Matchit</h3>
                    <p className="text-muted-foreground">
                      Kehittynyt algoritmi analysoi taitosi, kokemuksesi ja preferenssisi löytääkseen parhaat matchit
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Automaattinen Scoutaus</h3>
                    <p className="text-muted-foreground">
                      Agentti etsii jatkuvasti uusia työpaikkoja, joten sinun ei tarvitse
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <Bookmark className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1">Tallenna Kiinnostavat</h3>
                    <p className="text-muted-foreground">
                      Tallenna kiinnostavat työpaikat ja palaa niihin myöhemmin
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <Card className="bg-gradient-to-br from-blue-500 to-purple-600 text-white border-0">
                <CardHeader>
                  <CardTitle className="text-white">Aloita Tänään</CardTitle>
                  <CardDescription className="text-blue-100">
                    Liity tuhansien työnhakijoiden joukkoon, jotka löytävät unelmatyönsä helpommin
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {isAuthenticated ? (
                    <Link href="/profile">
                      <Button size="lg" variant="secondary" className="w-full">
                        Luo Profiili
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  ) : (
                    <Link href="/login">
                      <Button size="lg" variant="secondary" className="w-full">
                        Aloita Ilmaiseksi
                        <ArrowRight className="w-5 h-5 ml-2" />
                      </Button>
                    </Link>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Tulevat Ominaisuudet</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      LinkedIn Jobs API -integraatio
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Indeed ja muut kansainväliset lähteet
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Suomalaiset työpaikkasivustot
                    </li>
                    <li className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 bg-primary rounded-full"></div>
                      Notifikaatiot uusista matcheista
                    </li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </section>
    </div>
    </DashboardLayout>
  );
}
