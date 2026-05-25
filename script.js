// Variáveis globais do sistema de sessão e infra
let usuariosPermitidos = [];
let infraData = {};
let chamados = [];
let auditLog = [];
let currentUser = null;
let timerIA = null;

// FUNÇÃO CRUCIAL: Carrega os dados do arquivo data.json de forma assíncrona
async function inicializarSistema() {
    try {
        // Busca o arquivo JSON local
        const resposta = await fetch('data.json');
        if (!resposta.ok) throw new Error('Não foi possível carregar o banco de dados JSON.');
        
        const dadosJSON = await resposta.json();
        
        // Aloca a lista de usuários (fica apenas na memória por segurança)
        usuariosPermitidos = dadosJSON.usuariosPermitidos;

        // Se o localStorage estiver limpo, popula com os dados padrões do JSON
        if (!localStorage.getItem('infraData')) {
            localStorage.setItem('infraData', JSON.stringify(dadosJSON.infraDefault));
        }
        if (!localStorage.getItem('chamados')) {
            localStorage.setItem('chamados', JSON.stringify(dadosJSON.chamadosIniciais));
        }

        // Carrega os dados persistidos do navegador para as variáveis operacionais
        infraData = JSON.parse(localStorage.getItem('infraData'));
        chamados = JSON.parse(localStorage.getItem('chamados'));
        auditLog = JSON.parse(localStorage.getItem('auditLog')) || [];
        currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || null;

        // Valida se o usuário já estava logado antes e renderiza a tela correta
        verificarAutenticacao();

    } catch (erro) {
        console.error("Erro na carga inicial do sistema:", erro);
        alert("⚠️ Erro fatal ao carregar configurações do sistema. Certifique-se de estar rodando via Live Server.");
    }
}

// Disparador de alertas visuais customizados (Toast)
function spawnNotification(type, title, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast-slide p-4 rounded-xl shadow-xl border flex items-start gap-3 bg-white text-slate-800 pointer-events-auto border-l-4 ${
        type === 'success' ? 'border-l-emerald-500' : type === 'warning' ? 'border-l-amber-500' : 'border-l-blue-500'
    }`;

    const icon = type === 'success' ? 'fa-circle-check text-emerald-500' : type === 'warning' ? 'fa-triangle-exclamation text-amber-500' : 'fa-bell text-blue-500';

    toast.innerHTML = `
        <i class="fa-solid ${icon} mt-0.5 text-lg"></i>
        <div class="flex-1">
            <p class="font-bold text-sm">${title}</p>
            <p class="text-xs text-gray-500 mt-0.5">${message}</p>
        </div>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'scale(0.95)';
        toast.style.transition = 'all 0.2s ease';
        setTimeout(() => toast.remove(), 200);
    }, 4500);
}

function registrarAuditoria(chamadoId, acao, detalhes) { 
    auditLog.unshift({ 
        id: chamadoId, 
        acao, 
        detalhes, 
        usuario: currentUser ? currentUser.nome : "Sistema", 
        data: new Date().toLocaleString('pt-BR') 
    }); 
    localStorage.setItem('auditLog', JSON.stringify(auditLog)); 
} 

function fazerLogin(e) {
    e.preventDefault();
    const emailInput = document.getElementById('login-email').value.trim();
    const senhaInput = document.getElementById('login-senha').value;

    const usuarioValido = usuariosPermitidos.find(u => u.email === emailInput && u.senha === senhaInput);

    if (usuarioValido) {
        currentUser = usuarioValido;
        sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
        document.getElementById('loginForm').reset();
        verificarAutenticacao();
        spawnNotification('info', `Bem-vindo, ${currentUser.nome}!`, 'Sessão autenticada com sucesso.');
    } else {
        spawnNotification('warning', 'Falha no login', 'Credenciais não correspondem aos registros do campus.');
    }
}

function fazerLogout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    verificarAutenticacao();
}

function verificarAutenticacao() {
    const loginCtx = document.getElementById('login-container');
    const appCtx = document.getElementById('app-container');

    if (!currentUser) {
        loginCtx.classList.remove('hidden');
        appCtx.classList.add('hidden');
    } else {
        loginCtx.classList.add('hidden');
        appCtx.classList.remove('hidden');

        document.getElementById('user-name').textContent = currentUser.nome;
        document.getElementById('user-role').textContent = currentUser.role;
        document.getElementById('user-avatar').textContent = currentUser.nome.charAt(0);

        const btnNovoChamado = document.getElementById('nav-new-ticket');
        const btnAdmin = document.getElementById('nav-admin');
        const btnSettings = document.getElementById('nav-settings');

        currentUser.role === 'Técnico' ? btnNovoChamado.classList.add('hidden') : btnNovoChamado.classList.remove('hidden');
        (currentUser.role === 'Aluno' || currentUser.role === 'Professor') ? btnAdmin.classList.add('hidden') : btnAdmin.classList.remove('hidden');
        currentUser.role === 'Gestor' ? btnSettings.classList.remove('hidden') : btnSettings.classList.add('hidden');

        popularDropdownsFormulario();
        atualizarDashboard(); 
        navigateTo('dashboard'); 
    }
}

function popularDropdownsFormulario() {
    const selectLocal = document.getElementById('local');
    const selectCategoria = document.getElementById('categoria');
    const selectEquipamento = document.getElementById('equipamento');

    if (selectLocal) selectLocal.innerHTML = infraData.local.map(l => `<option value="${l}">${l}</option>`).join('');
    if (selectCategoria) selectCategoria.innerHTML = infraData.categoria.map(c => `<option value="${c}">${c}</option>`).join('');
    if (selectEquipamento) selectEquipamento.innerHTML = infraData.equipamento.map(e => `<option value="${e}">${e}</option>`).join('');
}

function renderizarListasConfiguracao() {
    ['local', 'categoria', 'equipamento'].forEach(tipo => {
        const target = document.getElementById(`list-settings-${tipo}`);
        if (target) {
            target.innerHTML = infraData[tipo].map((item, idx) => `
                <div class="flex justify-between items-center py-1.5 px-2 bg-white rounded-md border border-slate-200/60 shadow-sm">
                    <span class="font-medium text-slate-700">${item}</span>
                    <button onclick="removerItemInfra('${tipo}', ${idx})" class="text-red-500 hover:text-red-700 transition-colors"><i class="fa-solid fa-trash-can"></i></button>
                </div>
            `).join('');
        }
    });
}

function adicionarItemInfra(tipo) {
    const input = document.getElementById(`input-add-${tipo}`);
    if (!input || !input.value.trim()) return;

    infraData[tipo].push(input.value.trim());
    localStorage.setItem('infraData', JSON.stringify(infraData));
    input.value = '';
    
    renderizarListasConfiguracao();
    popularDropdownsFormulario();
    spawnNotification('success', 'Cadastro Atualizado', 'Nova infraestrutura registrada com sucesso.');
}

function removerItemInfra(tipo, index) {
    infraData[tipo].splice(index, 1);
    localStorage.setItem('infraData', JSON.stringify(infraData));
    renderizarListasConfiguracao();
    popularDropdownsFormulario();
}

function analisarDescricaoComIA(texto) {
    const badge = document.getElementById('ia-badge-typing');
    const suggestionBox = document.getElementById('ia-suggestion-box');
    const suggestionText = document.getElementById('ia-suggestion-text');
    const selectPrioridade = document.getElementById('prioridade');

    if (!texto.trim()) {
        suggestionBox.classList.add('hidden');
        badge.classList.add('opacity-0');
        return;
    }

    badge.classList.remove('opacity-0');
    clearTimeout(timerIA);

    timerIA = setTimeout(() => {
        badge.classList.add('opacity-0');
        let predicao = { prioridade: "Média", motivo: "Padrão analítico estrutural detectado." };

        const txt = texto.toLowerCase();
        if (txt.includes('urgente') || txt.includes('fogo') || txt.includes('curto') || txt.includes('parou de funcionar') || txt.includes('inundação')) {
            predicao = { prioridade: "Urgente", motivo: "Risco imediato à continuidade acadêmica ou segurança física." };
        } else if (txt.includes('quebrado') || txt.includes('não liga') || txt.includes('sem internet')) {
            predicao = { prioridade: "Alta", motivo: "Impacto direto no andamento das aulas práticas de laboratório." };
        } else if (txt.includes('limpeza') || txt.includes('lâmpada queimada') || txt.includes('ajuste')) {
            predicao = { prioridade: "Baixa", motivo: "Manutenção rotineira agendável de baixo impacto acadêmico." };
        }

        suggestionText.innerHTML = `<strong>Sugestão de Gravidade:</strong> Prioridade ${predicao.prioridade}. <br/><strong>Análise do padrão:</strong> ${predicao.motivo}`;
        suggestionBox.classList.remove('hidden');
        selectPrioridade.value = predicao.prioridade;
    }, 600);
}

function atualizarDashboard() { 
    if(!chamados) return;
    const total = chamados.length; 
    const aberto = chamados.filter(c => c.status === "Aberto").length; 
    const atendimento = chamados.filter(c => c.status === "Em Atendimento").length; 
    const resolvidos = chamados.filter(c => c.status === "Resolvido").length; 
 
    document.getElementById('total').textContent = total; 
    document.getElementById('aberto').textContent = aberto; 
    document.getElementById('atendimento').textContent = atendimento; 
    document.getElementById('resolvidos').textContent = resolvidos; 
 
    const chartContainer = document.getElementById('chart-categorias-container');
    if (chartContainer && infraData.categoria) {
        if (total === 0) {
            chartContainer.innerHTML = `<p class="text-xs text-gray-400 text-center py-6">Sem métricas de chamados abertos.</p>`;
        } else {
            const contagem = {};
            infraData.categoria.forEach(cat => contagem[cat] = 0);
            chamados.forEach(c => { if(contagem[c.categoria] !== undefined) contagem[c.categoria]++; });

            chartContainer.innerHTML = Object.keys(contagem).map(cat => {
                const qtd = contagem[cat];
                const pct = Math.round((qtd / total) * 100) || 0;
                return `
                    <div class="space-y-1">
                        <div class="flex justify-between text-xs font-semibold">
                            <span class="text-slate-600 truncate max-w-[180px]">${cat}</span>
                            <span class="text-slate-500">${qtd}x (${pct}%)</span>
                        </div>
                        <div class="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div class="bg-blue-600 h-2 rounded-full transition-all duration-500" style="width: ${pct}%"></div>
                        </div>
                    </div>
                `;
            }).join('');
        }
    }
} 
 
function criarChamado(e) { 
    e.preventDefault(); 
     
    const novo = { 
        id: "UF" + String(1000 + Math.floor(Math.random() * 9000)), 
        titulo: document.getElementById('titulo').value, 
        categoria: document.getElementById('categoria').value, 
        local: document.getElementById('local').value, 
        equipamento: document.getElementById('equipamento').value, 
        prioridade: document.getElementById('prioridade').value, 
        descricao: document.getElementById('descricao').value, 
        status: "Aberto", 
        data: new Date().toLocaleDateString('pt-BR'), 
        responsavel: null, 
        requisitante: currentUser.nome
    }; 
 
    chamados.unshift(novo); 
    localStorage.setItem('chamados', JSON.stringify(chamados)); 
    registrarAuditoria(novo.id, "Criação", `Chamado aberto por ${currentUser.nome} (${currentUser.role})`); 
 
    spawnNotification('success', 'Chamado Registrado', `Protocolo ${novo.id} enviado à central de triagem.`);
    document.getElementById('ticketForm').reset(); 
    document.getElementById('ia-suggestion-box').classList.add('hidden');
    atualizarDashboard(); 
    navigateTo('tickets'); 
} 
 
function renderizarChamados() { 
    const tbody = document.getElementById('table-body'); 
    if (!tbody) return;
    
    let chamadosFiltrados = chamados;
    if (currentUser.role === 'Aluno' || currentUser.role === 'Professor') {
        chamadosFiltrados = chamados.filter(c => c.requisitante === currentUser.nome);
    }

    if (chamadosFiltrados.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="px-6 py-8 text-center text-xs text-gray-400">Nenhuma ocorrência registrada sob o seu perfil.</td></tr>`;
        return;
    }

    tbody.innerHTML = chamadosFiltrados.map(c => ` 
        <tr class="hover:bg-slate-50/80 transition-colors text-sm"> 
            <td class="px-6 py-4 font-mono font-bold text-xs text-blue-600">${c.id}</td> 
            <td class="px-6 py-4">
                <div class="font-semibold text-slate-800">${c.titulo}</div>
                <div class="text-[11px] text-gray-400">Por: ${c.requisitante}</div>
            </td> 
            <td class="px-6 py-4 text-gray-600 font-medium">${c.local}</td> 
            <td class="px-6 py-4"> 
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    c.prioridade === 'Urgente' || c.prioridade === 'Alta' ? 'bg-red-50 text-red-700 border border-red-100' : 'bg-amber-50 text-amber-700 border border-amber-100'
                }"> 
                    ${c.prioridade} 
                </span> 
            </td> 
            <td class="px-6 py-4"> 
                <span class="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                    c.status === 'Resolvido' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : c.status === 'Em Atendimento' ? 'bg-blue-50 text-blue-700 border border-blue-100' : 'bg-orange-50 text-orange-700 border border-orange-100'
                }"> 
                    ${c.status} 
                </span> 
            </td> 
            <td class="px-6 py-4 text-gray-400 text-xs">${c.data}</td> 
        </tr> 
    `).join(''); 
} 
 
function renderizarAdmin() { 
    const container = document.getElementById('admin-tickets-list'); 
    if (!container) return;

    if (chamados.length === 0) {
        container.innerHTML = `<p class="text-center text-gray-400 text-sm py-6">Fila limpa. Sem ordens de serviço pendentes.</p>`;
        return;
    }

    container.innerHTML = chamados.map(c => ` 
        <div class="border rounded-2xl p-5 mb-4 hover:shadow-md transition-all bg-white"> 
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4"> 
                <div> 
                    <div class="flex items-center gap-2">
                        <span class="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded-md font-bold text-slate-600">${c.id}</span> 
                        <span class="text-[10px] font-bold uppercase px-2 py-0.5 rounded-md ${c.prioridade === 'Urgente' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'}">${c.prioridade}</span>
                    </div>
                    <h4 class="font-bold text-slate-800 text-lg mt-1.5">${c.titulo}</h4> 
                    <p class="text-xs text-gray-500 mt-0.5">📍 ${c.local} • <span class="font-semibold text-slate-600">Equipamento:</span> ${c.equipamento}</p> 
                    <p class="text-xs text-slate-600 mt-2 bg-slate-50 p-2.5 rounded-lg border border-slate-100">${c.descricao}</p>
                    ${c.responsavel ? `<p class="text-xs text-blue-600 mt-2 font-bold"><i class="fa-solid fa-user-gear"></i> Técnico Alocado: ${c.responsavel}</p>` : ''}
                </div> 
                <div class="flex flex-col gap-2 w-full md:w-auto">
                    <label class="text-[10px] font-bold uppercase tracking-wider text-slate-400">Alterar Status</label>
                    <select onchange="automaticStatusUpdate('${c.id}', this.value)" class="border rounded-xl px-4 py-2.5 bg-white font-semibold text-xs text-slate-700 focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"> 
                        <option value="Aberto" ${c.status === 'Aberto' ? 'selected' : ''}>Aberto / Pendente</option> 
                        <option value="Em Atendimento" ${c.status === 'Em Atendimento' ? 'selected' : ''}>Em Atendimento</option> 
                        <option value="Resolvido" ${c.status === 'Resolvido' ? 'selected' : ''}>Resolvido / Concluído</option> 
                    </select> 
                </div>
            </div> 
            <div class="mt-4 pt-4 border-t border-slate-100 flex gap-2"> 
                <button onclick="atribuirTecnico('${c.id}')" class="text-xs bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold transition-colors shadow-sm text-slate-700"> 
                    <i class="fa-solid fa-user-plus mr-1"></i> Atribuir Técnico 
                </button> 
                <button onclick="verHistorico('${c.id}')" class="text-xs bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2 rounded-xl font-bold transition-colors shadow-sm text-slate-700"> 
                    <i class="fa-solid fa-clock-rotate-left mr-1"></i> Log de Auditoria 
                </button> 
            </div> 
        </div> 
    `).join(''); 
} 
 
function automaticStatusUpdate(id, novoStatus) { 
    const chamado = chamados.find(c => c.id === id); 
    if (chamado) { 
        const antigo = chamado.status; 
        chamado.status = novoStatus; 
        registrarAuditoria(id, "Alteração de Status", `${antigo} → ${novoStatus}`); 
         
        localStorage.setItem('chamados', JSON.stringify(chamados)); 
        renderizarAdmin(); 
        atualizarDashboard(); 
         
        if (novoStatus === "Resolvido") { 
            spawnNotification('success', 'Notificação de Encerramento', `E-mail acadêmico disparado automaticamente para ${chamado.requisitante}.`);
        } else {
            spawnNotification('info', 'Status Updated', `Chamado ${id} agora está ${novoStatus}.`);
        }
    } 
} 
 
function atribuirTecnico(id) { 
    const tecnico = prompt("Digite o nome ou credencial do Técnico responsável:"); 
    if (tecnico && tecnico.trim()) { 
        const chamado = chamados.find(c => c.id === id); 
        if (chamado) {
            chamado.responsavel = tecnico.trim(); 
            registrarAuditoria(id, "Atribuição", `Técnico alocado: ${tecnico.trim()}`); 
            spawnNotification('success', 'Técnico Alocado', `Ordem de serviço vinculada a ${tecnico.trim()}`);
            renderizarAdmin(); 
        }
    } 
} 
 
function verHistorico(id) { 
    const chamado = chamados.find(c => c.id === id); 
    if (chamado) { 
        let texto = `Histórico de Transparência do Chamado ${id}\n\n`; 
        const logsFiltrados = auditLog.filter(log => log.id === id);
        
        if(logsFiltrados.length === 0) {
            alert("Nenhum evento registrado no log.");
            return;
        }
        logsFiltrados.forEach(log => { 
            texto += `🗓️ ${log.data}\n• Evento: ${log.acao}\n• Detalhe: ${log.detalhes}\n• Autor: ${log.usuario}\n\n`; 
        }); 
        alert(texto); 
    } 
} 
 
function navigateTo(page) { 
    if (page === 'admin' && currentUser && (currentUser.role === 'Aluno' || currentUser.role === 'Professor')) {
        spawnNotification('warning', 'Acesso Negado', 'Seu perfil não possui autorização técnica de triagem.');
        return;
    }
    if (page === 'settings' && currentUser && currentUser.role !== 'Gestor') {
        spawnNotification('warning', 'Acesso Restrito', 'Apenas gestores de infraestrutura acessam este painel.');
        return;
    }
    if (page === 'new-ticket' && currentUser && currentUser.role === 'Técnico') {
        spawnNotification('warning', 'Ação Não Permitida', 'Técnicos operam exclusivamente na resolução de filas.');
        return;
    }

    document.querySelectorAll('#content > div').forEach(div => div.classList.add('hidden')); 
    
    const targetView = document.getElementById(page + '-view');
    if (targetView) targetView.classList.remove('hidden'); 
     
    document.getElementById('page-title').textContent = { 
        'dashboard': 'Dashboard de Performance', 
        'new-ticket': 'Portal de Abertura de Chamados', 
        'tickets': 'Histórico de Ocorrências', 
        'admin': 'Painel Administrativo Técnico',
        'settings': 'Gerenciador de Ativos e Infraestrutura'
    }[page] || 'Dashboard'; 
 
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-blue-50', 'text-blue-600', 'font-bold', 'border-l-4', 'border-blue-600');
        btn.classList.add('text-gray-600');
    });

    const activeBtn = document.getElementById('nav-' + page);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-600');
        activeBtn.classList.add('bg-blue-50', 'text-blue-600', 'font-bold', 'border-l-4', 'border-blue-600');
    }

    if (page === 'tickets') renderizarChamados(); 
    if (page === 'admin') renderizarAdmin(); 
    if (page === 'settings') renderizarListasConfiguracao();
} 

// Ativação baseada no ciclo assíncrono moderno
window.onload = () => { 
    inicializarSistema();
};