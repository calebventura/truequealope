"use client";

import Link from "next/link";

const WHATSAPP_NUMBER = "51913350106";
const WHATSAPP_MESSAGE_COMMUNITY =
  "Hola, quiero solicitar crear una nueva comunidad en Truequealope. Nombre de la comunidad: ";
const WHATSAPP_MESSAGE_INNOVATION =
  "Hola, quiero conversar con el Hub de Innovacion de Truequealope.%0A%0AProyecto/idea: %0AObjetivo de negocio: %0APlazo o urgencia: %0AContactarme a (correo/teléfono): ";

export function Footer() {
  const whatsappCommunityHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    WHATSAPP_MESSAGE_COMMUNITY
  )}`;
  const whatsappInnovationHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MESSAGE_INNOVATION}`;

  return (
    <footer className="border-t border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 text-gray-800 dark:text-gray-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
        <div className="space-y-2">
          <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-300">
            Truequealope
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Trueques y ventas con comunidades seguras, badges de confianza y
            control sobre visibilidad. Publica gratis, negocia y concreta con
            transparencia.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Contacto
          </h4>
          <Link
            href="mailto:atencionalcliente@truequealope.com"
            className="text-sm text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200"
          >
            atencionalcliente@truequealope.com
          </Link>
          <div>
            <a
              href={whatsappCommunityHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
              aria-label="Solicitar comunidad por WhatsApp"
            >
              <svg
                className="w-4 h-4"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M20.52 3.48A11.77 11.77 0 0 0 12.04 0C5.49 0 .24 5.25.24 11.73c0 2.07.54 4.1 1.57 5.89L0 24l6.55-1.71a11.82 11.82 0 0 0 5.48 1.38h.01c6.55 0 11.8-5.26 11.8-11.74 0-3.14-1.23-6.08-3.32-8.25ZM12.03 21.3h-.01a9.8 9.8 0 0 1-5-.35l-.36-.14-3.89 1.02 1.04-3.79-.17-.39a9.77 9.77 0 0 1-1.2-4.75c0-5.39 4.39-9.77 9.8-9.77 2.62 0 5.08 1.02 6.93 2.88a9.72 9.72 0 0 1 2.87 6.9c-.01 5.4-4.4 9.79-9.81 9.79Zm5.36-7.32c-.29-.14-1.72-.85-1.98-.95-.26-.1-.45-.15-.64.15-.19.29-.74.95-.9 1.15-.17.2-.33.22-.62.08-.29-.14-1.21-.44-2.3-1.41-.85-.76-1.42-1.7-1.58-1.99-.17-.29-.02-.45.12-.6.12-.12.29-.33.43-.5.14-.17.19-.29.29-.48.1-.19.05-.36-.03-.5-.08-.14-.64-1.54-.88-2.1-.23-.55-.47-.48-.64-.49l-.55-.01c-.19 0-.5.07-.76.36-.26.29-1 1-1 2.46 0 1.46 1.02 2.87 1.16 3.07.14.19 2.01 3.24 4.88 4.54.68.29 1.21.46 1.63.58.68.22 1.29.19 1.77.12.54-.08 1.72-.7 1.96-1.38.24-.68.24-1.26.17-1.38-.07-.12-.26-.19-.55-.33Z" />
              </svg>
              Solicitar comunidad
            </a>
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Sobre Truequealope
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Creamos confianza con badges de visibilidad, métricas de contacto y
            ubicación por comunidades. Facilita trueques, permutas o ventas con
            rapidez y cero fricción.
          </p>
        </div>

        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Hub de Innovación
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-300">
            Somos un equipo de producto y tecnología que diseña, construye y
            lanza soluciones digitales a medida: marketplaces, apps móviles,
            integraciones y analítica. Cuéntanos tu idea; prototipamos, validamos
            y llevamos tu proyecto a producción.
          </p>
          <a
            href={whatsappInnovationHref}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-300 text-sm font-semibold hover:text-indigo-700 dark:hover:text-indigo-200"
            aria-label="Hablar con el hub de innovación"
          >
            Hablemos de tu proyecto
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M17 8l4 4m0 0l-4 4m4-4H3"
              />
            </svg>
          </a>
        </div>
      </div>

      <div className="border-t border-gray-200 dark:border-gray-800 py-4 text-center text-xs text-gray-500 dark:text-gray-400">
        © {new Date().getFullYear()} Truequealope. Todos los derechos reservados.
      </div>
    </footer>
  );
}
