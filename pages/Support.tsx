
import React from 'react';
import { Icons } from '../components/Icons';

export const Support: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div>
          <h1 className="text-2xl font-bold text-gray-900">Ayuda y Soporte</h1>
          <p className="text-gray-500 mt-2">Encuentra respuestas a preguntas frecuentes o contacta a nuestro equipo de soporte legal.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-2 space-y-6">
               <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                   <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
                       <Icons.Help size={20} className="text-purple-600" />
                       Preguntas Frecuentes
                   </h3>
                   <div className="space-y-4">
                       {[
                           { q: "¿Como subo un contrato en PDF?", a: "Ve a Documentos o Contratos, haz clic en 'Subir PDF' y selecciona tu archivo. La IA lo limpiara y categorizara automaticamente." },
                           { q: "¿Como funciona el entrenamiento del ADN del Estudio?", a: "Ve a Configuracion > ADN del Estudio. Sube 5-10 ejemplos de contratos previos. La IA analiza tono y estructura para replicarlos en futuros borradores." },
                           { q: "¿Puedo invitar clientes externos?", a: "Por ahora, LegalFlow es para uso interno del estudio. Puedes exportar contratos en PDF/Word y enviarlos manualmente." }
                       ].map((faq, i) => (
                           <div key={i} className="border-b border-gray-100 last:border-0 pb-4 last:pb-0">
                               <h4 className="text-sm font-semibold text-gray-800 mb-1">{faq.q}</h4>
                               <p className="text-sm text-gray-600 leading-relaxed">{faq.a}</p>
                           </div>
                       ))}
                   </div>
               </div>

               <div className="bg-purple-50 rounded-xl border border-purple-100 p-6 flex items-start gap-4">
                   <div className="p-3 bg-white rounded-lg shadow-sm text-purple-600">
                       <Icons.Sparkles size={24} />
                   </div>
                   <div>
                        <h3 className="font-bold text-gray-900">Entrenamiento de LegalFlow AI</h3>
                        <p className="text-sm text-gray-600 mt-1 mb-3">
                            ¿Necesitas ajustar la IA a tu jurisdiccion? Nuestro equipo ofrece onboarding dedicado.
                        </p>
                        <button className="text-sm font-bold text-purple-700 hover:text-purple-900 hover:underline">Agendar una consulta &rarr;</button>
                   </div>
               </div>
          </div>

          <div className="space-y-6">
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-bold text-gray-900 mb-4">Contactar Soporte</h3>
                  <form className="space-y-4">
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Asunto</label>
                          <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white">
                              <option>Problema Tecnico</option>
                              <option>Consulta de Facturacion</option>
                              <option>Solicitud de Funcion</option>
                          </select>
                      </div>
                      <div>
                          <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Mensaje</label>
                          <textarea rows={4} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none" placeholder="Describe tu problema..." />
                      </div>
                      <button type="button" className="w-full bg-gray-900 text-white py-2 rounded-lg font-bold text-sm hover:bg-gray-800">Enviar Mensaje</button>
                  </form>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
                  <h3 className="font-bold text-gray-900 mb-2">Estado del Sistema</h3>
                  <div className="flex items-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                      <span className="text-sm font-medium text-green-700">Todos los sistemas operativos</span>
                  </div>
                  <p className="text-xs text-gray-500">Ultima actualizacion: ahora mismo</p>
              </div>
          </div>
      </div>
    </div>
  );
};
