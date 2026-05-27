let usuariosPermitidos = [];
let infraData = {};
let chamados = [];
let auditLog = [];
let currentUser = null;
let timerIA = null;
let currentStatusFilter = 'Todos';
let chamadoAtualId = null; 

async function inicializarSistema() {
    try {
        carregarModoEscuro(); 

        const resposta = await fetch('data.json');
        if (!resposta.ok) throw new Error('Falha ao ler data.json');
        
        const dadosJSON = await resposta.json();
        usuariosPermitidos = dadosJSON.usuariosPermitidos;

        if (!localStorage.getItem('infraData')) {
            localStorage.setItem('infraData', JSON.stringify(dadosJSON.infraDefault));
        }
        if (!localStorage.getItem('chamados')) {
            const chamadosAjustados = dadosJSON.chamadosIniciais.map(c => {
                if(!c.timeline) c.timeline = [{ autor: c.requisitante, tipo: 'user', mensagem: c.descricao, data: c.data }];
                return c;
            });
            localStorage.setItem('chamados', JSON.stringify(chamadosAjustados));
        }

        infraData = JSON.parse(localStorage.getItem('infraData'));
        chamados = JSON.parse(localStorage.getItem('chamados'));
        auditLog = JSON.parse(localStorage.getItem('auditLog')) || [];
        
        currentUser = JSON.parse(sessionStorage.getItem('currentUser')) || JSON.parse(localStorage.getItem('currentUser')) || null;

        verificarAutenticacao();

    } catch (erro) {
        console.error(erro);
        alert("Erro fatal ao carregar o sistema. Utilize um Live Server.");
    }
}

// ---- MODO ESCURO E UI ----
function carregarModoEscuro() {
    if (localStorage.theme === 'dark' || (!('theme' in localStorage) && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
        document.documentElement.classList.add('dark');
        const dot = document.getElementById('dark-mode-dot');
        if(dot) dot.classList.add('translate-x-4');
    }
}

function toggleDarkMode() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    const dot = document.getElementById('dark-mode-dot');
    if (isDark) dot.classList.add('translate-x-4');
    else dot.classList.remove('translate-x-4');
}

function toggleProfileMenu() { document.getElementById('profile-menu').classList.toggle('hidden'); }
function toggleMenu() { document.getElementById('sidebar').classList.toggle('-translate-x-full'); }
function toggleSenha() {
    const input = document.getElementById('login-senha');
    const icone = document.getElementById('icone-senha');
    if (input.type === 'password') { input.type = 'text'; icone.classList.replace('fa-eye', 'fa-eye-slash'); } 
    else { input.type = 'password'; icone.classList.replace('fa-eye-slash', 'fa-eye'); }
}

function spawnNotification(type, title, message) {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    const color = type === 'success' ? 'emerald-500' : type === 'warning' ? 'brand-orange' : 'brand-green';
    const icon = type === 'success' ? 'fa-circle-check' : type === 'warning' ? 'fa-triangle-exclamation' : 'fa-bell';

    toast.className = `toast-slide p-4 rounded-xl shadow-2xl border flex items-start gap-3 bg-white dark:bg-slate-800 text-gray-800 dark:text-white border-l-4 border-l-${color}`;
    toast.innerHTML = `<i class="fa-solid ${icon} text-${color} mt-0.5 text-lg"></i><div><p class="font-bold text-sm">${title}</p><p class="text-xs text-gray-500">${message}</p></div>`;
    
    container.appendChild(toast);
    setTimeout(() => { toast.style.opacity = '0'; setTimeout(() => toast.remove(), 300); }, 4500);
}

// ---- NAVEGAÇÃO ----
function navigateTo(page) {
    document.querySelectorAll('.page-content').forEach(el => el.classList.add('hidden'));
    const pageEl = document.getElementById('page-' + page);
    if(pageEl) pageEl.classList.remove('hidden');

    // Define o título dinâmico dependendo de quem está logado
    let titleTickets = 'Meus Chamados';
    if(currentUser) {
        if(currentUser.role === 'Técnico') titleTickets = 'Fila de Chamados';
        if(currentUser.role === 'Gestor') titleTickets = 'Todos os Chamados';
    }

    document.getElementById('page-title').textContent = { 
        'dashboard': 'Visão Geral', 
        'new-ticket': 'Novo Chamado', 
        'tickets': titleTickets, 
        'admin': 'Diretório de Utilizadores', 
        'settings': 'Configurações' 
    }[page] || 'Visão Geral'; 

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('bg-stone-50', 'dark:bg-slate-700', 'text-brand-green', 'border-l-4', 'border-brand-green');
        btn.classList.add('text-gray-600');
    });

    const activeBtn = document.getElementById('nav-' + page);
    if (activeBtn) activeBtn.classList.add('bg-stone-50', 'dark:bg-slate-700', 'text-brand-green', 'border-l-4', 'border-brand-green');

    if (page === 'tickets') renderizarChamados();
}

// ---- AUTENTICAÇÃO ----
function fazerLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('btn-login');
    const loading = document.getElementById('loading-login');
    const emailInput = document.getElementById('login-email').value.trim();
    const senhaInput = document.getElementById('login-senha').value;
    const lembrar = document.getElementById('lembrar-mim').checked;

    btn.disabled = true; loading.classList.remove('hidden');

    setTimeout(() => {
        const usuarioValido = usuariosPermitidos.find(u => u.email === emailInput && u.senha === senhaInput);
        if (usuarioValido) {
            currentUser = usuarioValido;
            if (lembrar) localStorage.setItem('currentUser', JSON.stringify(currentUser));
            else sessionStorage.setItem('currentUser', JSON.stringify(currentUser));
            document.getElementById('loginForm').reset();
            verificarAutenticacao();
            spawnNotification('info', `Bem-vindo, ${currentUser.nome}!`, 'Sessão autenticada.');
        } else {
            spawnNotification('warning', 'Falha no login', 'Credenciais inválidas.');
        }
        btn.disabled = false; loading.classList.add('hidden');
    }, 800);
}

function fazerLogout() {
    currentUser = null;
    sessionStorage.removeItem('currentUser');
    localStorage.removeItem('currentUser');
    document.getElementById('profile-menu').classList.add('hidden');
    verificarAutenticacao();
}

function verificarAutenticacao() {
    const loginCtx = document.getElementById('login-container');
    const appCtx = document.getElementById('app-container');

    if (!currentUser) {
        loginCtx.classList.replace('opacity-0', 'opacity-100');
        loginCtx.classList.remove('pointer-events-none');
        appCtx.classList.replace('scale-100', 'scale-95');
        appCtx.classList.add('pointer-events-none', 'blur-md');
    } else {
        loginCtx.classList.replace('opacity-100', 'opacity-0');
        loginCtx.classList.add('pointer-events-none');
        appCtx.classList.replace('scale-95', 'scale-100');
        appCtx.classList.remove('pointer-events-none', 'blur-md');

        document.getElementById('user-name').textContent = currentUser.nome;
        document.getElementById('user-role').textContent = currentUser.role;
        document.getElementById('user-avatar').textContent = currentUser.nome.charAt(0);
        document.getElementById('welcome-message').innerHTML = `Olá, ${currentUser.nome.split(' ')[0]}! 👋`;

        // Controle de Acesso e Permissões
        const btnNovoChamado = document.getElementById('nav-new-ticket');
        const btnAdmin = document.getElementById('nav-admin');
        const btnSettings = document.getElementById('nav-settings');
        const btnQuick = document.getElementById('btn-quick-action');
        const filtroTecnico = document.getElementById('filtro-tecnico');
        const btnTickets = document.getElementById('nav-tickets'); // Pegamos o botão da aba

        if(currentUser.role === 'Técnico') {
            btnNovoChamado.classList.add('hidden'); 
            btnQuick.classList.add('hidden');
            btnAdmin.classList.add('hidden');
            btnSettings.classList.add('hidden');
            if(filtroTecnico) filtroTecnico.classList.add('hidden');
            
            // MUDA O NOME DA ABA PARA O TÉCNICO
            if(btnTickets) btnTickets.innerHTML = '<i class="fa-solid fa-list-check w-5 text-center"></i> Fila de Chamados';
        } 
        else if (currentUser.role === 'Gestor') {
            btnNovoChamado.classList.add('hidden'); 
            btnQuick.classList.add('hidden');
            btnAdmin.classList.remove('hidden');
            btnSettings.classList.remove('hidden');
            
            if(filtroTecnico) {
                filtroTecnico.classList.remove('hidden');
                const tecnicos = usuariosPermitidos.filter(u => u.role === 'Técnico');
                filtroTecnico.innerHTML = '<option value="todos">Todos os Técnicos</option>' + tecnicos.map(t => `<option value="${t.nome}">${t.nome}</option>`).join('');
            }
            renderizarListaUsuariosGestor();
            
            // MUDA O NOME DA ABA PARA O GESTOR
            if(btnTickets) btnTickets.innerHTML = '<i class="fa-solid fa-layer-group w-5 text-center"></i> Todos os Chamados';
        } 
        else {
            btnNovoChamado.classList.remove('hidden'); 
            btnQuick.classList.remove('hidden');
            btnAdmin.classList.add('hidden');
            btnSettings.classList.add('hidden');
            if(filtroTecnico) filtroTecnico.classList.add('hidden');
            
            // MANTÉM O NOME PADRÃO PARA ALUNOS E PROFESSORES
            if(btnTickets) btnTickets.innerHTML = '<i class="fa-solid fa-receipt w-5 text-center"></i> Meus Chamados';
        }

        popularDropdownsFormulario();
        renderizarListasConfiguracao();
        atualizarDashboard(); 
        navigateTo('dashboard'); 
    }
}

// ---- DASHBOARD ----
function atualizarDashboard() {
    if(!chamados) return;
    
    const filtro = document.getElementById('filtro-periodo')?.value || 'todos';
    const agora = new Date();
    
    let chamadosFiltrados = chamados;
    if(currentUser.role === 'Aluno' || currentUser.role === 'Professor') {
        chamadosFiltrados = chamados.filter(c => c.requisitante === currentUser.nome);
    }
    
    chamadosFiltrados = chamadosFiltrados.filter(c => {
        if(filtro === 'todos') return true;
        const partes = c.data ? c.data.split(' ')[0].split('/') : [];
        if(partes.length < 3) return true;
        const dataC = new Date(`${partes[2]}-${partes[1]}-${partes[0]}`);
        const diffDays = Math.ceil(Math.abs(agora - dataC) / (1000 * 60 * 60 * 24));
        if(filtro === 'hoje') return diffDays <= 1;
        if(filtro === 'semana') return diffDays <= 7;
        if(filtro === 'mes') return diffDays <= 30;
        return true;
    });

    const total = chamadosFiltrados.length;
    document.getElementById('total').textContent = total;
    document.getElementById('aberto').textContent = chamadosFiltrados.filter(c => c.status === "Aberto").length;
    document.getElementById('atendimento').textContent = chamadosFiltrados.filter(c => c.status === "Em Atendimento").length;
    document.getElementById('resolvidos').textContent = chamadosFiltrados.filter(c => c.status === "Resolvido").length;

    const chartContainer = document.getElementById('chart-categorias-container');
    if (chartContainer) {
        if (total === 0) {
            chartContainer.innerHTML = `<p class="text-xs text-gray-400 text-center py-6 font-bold">Sem métricas cadastradas.</p>`;
        } else {
            const contagem = {};
            infraData.categoria.forEach(cat => contagem[cat] = 0);
            chamadosFiltrados.forEach(c => { if(contagem[c.categoria] !== undefined) contagem[c.categoria]++; });
            
            chartContainer.innerHTML = Object.keys(contagem).map(cat => {
                const qtd = contagem[cat];
                const pct = Math.round((qtd / total) * 100) || 0;
                return `
                    <div class="space-y-1.5">
                        <div class="flex justify-between text-xs font-bold text-gray-600 dark:text-gray-300">
                            <span class="truncate max-w-[150px]">${cat}</span> <span>${qtd}x (${pct}%)</span>
                        </div>
                        <div class="w-full bg-gray-100 dark:bg-slate-700 h-2 rounded-full overflow-hidden">
                            <div class="bg-brand-green h-2 rounded-full transition-all duration-1000" style="width: ${pct}%"></div>
                        </div>
                    </div>`;
            }).join('');
        }
    }

    const recentContainer = document.getElementById('recent-tickets-container');
    if (recentContainer) {
        const recentes = [...chamadosFiltrados].reverse().slice(0, 5); 
        if(recentes.length === 0) {
            recentContainer.innerHTML = `<p class="text-sm text-gray-400 text-center py-6 font-bold">Nenhum chamado no período.</p>`;
        } else {
            recentContainer.innerHTML = recentes.map(c => `
                <div onclick="abrirModalTicket('${c.id}')" class="cursor-pointer bg-stone-50 dark:bg-slate-900/50 p-4 rounded-xl border border-gray-100 dark:border-slate-700 hover:border-brand-green transition-all flex items-center justify-between shadow-sm">
                    <div>
                        <p class="text-sm font-bold text-gray-800 dark:text-white truncate max-w-[200px] sm:max-w-xs">${c.titulo}</p>
                        <p class="text-[11px] text-gray-500 mt-0.5"><i class="fa-regular fa-clock mr-1"></i> ${c.data}</p>
                    </div>
                    <span class="text-[10px] px-2.5 py-1 rounded-md font-bold uppercase ${c.status === 'Aberto' ? 'bg-red-100 text-red-700' : c.status === 'Em Atendimento' ? 'bg-orange-100 text-orange-700' : 'bg-emerald-100 text-emerald-700'}">${c.status}</span>
                </div>
            `).join('');
        }
    }
}

// ---- IA NO TÍTULO ----
function analisarTituloKB(texto) {
    const box = document.getElementById('kb-suggestion-box');
    const textEl = document.getElementById('kb-suggestion-text');
    
    if(!texto || texto.length < 5) { box.classList.add('hidden'); return; }

    clearTimeout(timerIA);
    timerIA = setTimeout(() => {
        const p = texto.toLowerCase();
        let sugestao = '';

        if(p.includes('wi-fi') || p.includes('internet') || p.includes('rede')) 
            sugestao = "A rede está instável? Tente 'Esquecer a rede' no seu dispositivo e conectar novamente antes de abrir o chamado.";
        else if (p.includes('projetor') || p.includes('data show') || p.includes('tela')) 
            sugestao = "Projetor não liga? Verifique se o cabo de energia e o HDMI (Input 1) estão bem fixados.";
        else if (p.includes('impressora') || p.includes('papel') || p.includes('toner')) 
            sugestao = "Problema na impressora? Veja se o painel exibe 'Papel Encravado' e abra a tampa traseira para verificar.";
        
        if(sugestao) { textEl.textContent = sugestao; box.classList.remove('hidden'); } 
        else { box.classList.add('hidden'); }
    }, 600);
}

// ---- CRIAÇÃO E LISTAGEM ----
function criarChamado(e) {
    e.preventDefault();
    const titulo = document.getElementById('titulo').value;
    const local = document.getElementById('local').value;
    const categoria = document.getElementById('categoria').value;
    const equip = document.getElementById('equipamento').value;
    const prioridade = document.getElementById('prioridade').value;
    const descricao = document.getElementById('descricao').value;

    const novoChamado = {
        id: "UF" + Math.floor(Math.random() * 9000 + 1000),
        titulo, local, categoria, equipamento: equip, prioridade, descricao,
        status: "Aberto", requisitante: currentUser.nome, responsavel: null,
        data: new Date().toLocaleString('pt-BR'),
        timeline: [{ autor: currentUser.nome, tipo: 'user', mensagem: descricao, data: new Date().toLocaleString('pt-BR') }]
    };

    chamados.push(novoChamado);
    localStorage.setItem('chamados', JSON.stringify(chamados));
    
    e.target.reset();
    document.getElementById('kb-suggestion-box').classList.add('hidden');
    spawnNotification('success', 'Sucesso!', `Chamado ${novoChamado.id} criado.`);
    atualizarDashboard(); navigateTo('tickets');
}

function filtrarPorStatus(status, btnElement) {
    currentStatusFilter = status;
    document.querySelectorAll('.status-filter-btn').forEach(btn => {
        btn.classList.replace('bg-brand-green', 'bg-stone-50'); btn.classList.replace('text-white', 'text-gray-600');
        if(btn.classList.contains('dark:bg-slate-700')) return;
        btn.classList.add('dark:bg-slate-700', 'dark:text-gray-300');
    });
    if (btnElement) {
        btnElement.classList.replace('bg-stone-50', 'bg-brand-green');
        btnElement.classList.replace('text-gray-600', 'text-white');
        btnElement.classList.remove('dark:bg-slate-700', 'dark:text-gray-300');
    }
    renderizarChamados();
}

function filtrarChamados() { renderizarChamados(); }

function renderizarChamados() {
    const container = document.getElementById('lista-chamados-container');
    if (!container) return;
    const busca = document.getElementById('busca-chamado')?.value.toLowerCase() || '';
    const tecnicoFiltro = document.getElementById('filtro-tecnico')?.value || 'todos';
    
    let meusChamados = chamados;
    if (currentUser.role === 'Aluno' || currentUser.role === 'Professor') {
        meusChamados = chamados.filter(c => c.requisitante === currentUser.nome);
    }
    
    meusChamados = meusChamados.filter(c => {
        const matchStatus = currentStatusFilter === 'Todos' || c.status === currentStatusFilter;
        const matchBusca = c.id.toLowerCase().includes(busca) || c.titulo.toLowerCase().includes(busca) || c.local.toLowerCase().includes(busca);
        const matchTecnico = (tecnicoFiltro === 'todos') || (c.responsavel === tecnicoFiltro);

        return matchStatus && matchBusca && matchTecnico;
    }).reverse();

    if (meusChamados.length === 0) {
        container.innerHTML = `<div class="flex flex-col items-center justify-center h-full text-gray-400 space-y-3"><i class="fa-solid fa-folder-open text-4xl"></i><p>Nenhum chamado encontrado.</p></div>`;
        return;
    }

    container.innerHTML = `
        <div class="overflow-x-auto">
            <table class="w-full text-left text-sm whitespace-nowrap">
                <thead class="text-xs text-gray-500 bg-gray-50 dark:bg-slate-800 dark:text-gray-400 uppercase font-bold sticky top-0">
                    <tr><th class="px-6 py-4 rounded-tl-xl">Protocolo</th><th class="px-6 py-4">Assunto</th><th class="px-6 py-4">Técnico</th><th class="px-6 py-4">Status</th><th class="px-6 py-4">Prioridade</th><th class="px-6 py-4 text-right rounded-tr-xl">Ação</th></tr>
                </thead>
                <tbody class="divide-y divide-gray-100 dark:divide-slate-700/50">
                    ${meusChamados.map(c => `
                        <tr class="hover:bg-stone-50 dark:hover:bg-slate-800/50 transition-colors group cursor-pointer" onclick="abrirModalTicket('${c.id}')">
                            <td class="px-6 py-4 font-bold text-gray-800 dark:text-white group-hover:text-brand-green">${c.id}</td>
                            <td class="px-6 py-4"><p class="font-bold text-gray-700 dark:text-gray-200">${c.titulo}</p><p class="text-xs text-gray-500">${c.local}</p></td>
                            <td class="px-6 py-4 text-xs font-medium text-gray-500">${c.responsavel || '<span class="italic text-gray-400">A aguardar...</span>'}</td>
                            <td class="px-6 py-4"><span class="px-3 py-1 text-[10px] font-bold uppercase rounded bg-gray-100 text-gray-600 dark:bg-slate-700">${c.status}</span></td>
                            <td class="px-6 py-4 text-xs font-bold ${c.prioridade==='Alta'||c.prioridade==='Urgente'?'text-red-500':c.prioridade==='Média'?'text-brand-orange':'text-gray-500'}">${c.prioridade}</td>
                            <td class="px-6 py-4 text-right"><button class="text-brand-green font-bold text-xs hover:underline">Ver Detalhes</button></td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

// ---- TIMELINE E COMENTÁRIOS ----
function abrirModalTicket(id) {
    chamadoAtualId = id; 
    const chamado = chamados.find(c => c.id === id);
    if(!chamado) return;
    
    document.getElementById('modal-protocol').innerText = chamado.id;
    document.getElementById('modal-title').innerText = chamado.titulo;
    
    const badge = document.getElementById('badge-status-atual');
    if(badge) {
        badge.innerText = chamado.status;
        badge.className = `px-2 py-1 text-[10px] font-bold uppercase rounded shadow-sm ${
            chamado.status === 'Aberto' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' : 
            chamado.status === 'Em Atendimento' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' : 
            'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
        }`;
    }

    const techActions = document.getElementById('tech-actions-container');
    if(techActions) {
        // EXCLUSIVO PARA O TÉCNICO VER OS BOTÕES DE AÇÃO
        if (currentUser.role === 'Técnico') {
            techActions.classList.remove('hidden');
        } else {
            techActions.classList.add('hidden');
        }
    }
    
    if(!chamado.timeline) chamado.timeline = [{ autor: chamado.requisitante, tipo: 'user', mensagem: chamado.descricao, data: chamado.data }];
    
    renderizarTimeline(chamado.timeline);
    
    document.getElementById('btn-enviar-comentario').onclick = () => adicionarComentario(chamado.id);
    
    const modal = document.getElementById('ticket-modal');
    const modalContent = document.getElementById('ticket-modal-content');
    modal.classList.remove('hidden');
    
    setTimeout(() => { 
        modal.classList.add('opacity-100'); 
        modalContent.classList.remove('scale-95'); 
        modalContent.classList.add('scale-100'); 
    }, 10);
}

function fecharModalTicket() {
    const modal = document.getElementById('ticket-modal');
    const modalContent = document.getElementById('ticket-modal-content');
    modal.classList.remove('opacity-100'); modalContent.classList.remove('scale-100'); modalContent.classList.add('scale-95');
    setTimeout(() => modal.classList.add('hidden'), 300);
    chamadoAtualId = null;
}

function atualizarStatusChamado(novoStatus) {
    if(!chamadoAtualId) return;
    
    const idx = chamados.findIndex(c => c.id === chamadoAtualId);
    if(idx !== -1) {
        chamados[idx].status = novoStatus;
        chamados[idx].responsavel = currentUser.nome; // Regista quem assumiu o chamado
        
        chamados[idx].timeline.push({
            autor: 'Sistema',
            tipo: 'system',
            mensagem: `O estado do chamado foi atualizado para "${novoStatus}" pelo técnico ${currentUser.nome}.`,
            data: new Date().toLocaleString('pt-BR')
        });
        
        localStorage.setItem('chamados', JSON.stringify(chamados));
        spawnNotification('success', 'Estado Atualizado', `O chamado agora encontra-se ${novoStatus}.`);
        
        abrirModalTicket(chamadoAtualId); 
        renderizarChamados();
        atualizarDashboard();
    }
}

function renderizarTimeline(timeline) {
    const container = document.getElementById('timeline-container');
    container.innerHTML = timeline.map(item => {
        const isUser = item.tipo === 'user';
        const isSystem = item.tipo === 'system';
        const icon = isUser ? 'fa-user' : (isSystem ? 'fa-robot' : 'fa-headset');
        const bgIcon = isUser ? 'bg-brand-lightbeige dark:bg-slate-700 text-brand-green border-brand-beige/50' : (isSystem ? 'bg-gray-200 text-gray-500' : 'bg-brand-green text-white');
        const bgChat = isUser ? 'bg-gray-50 dark:bg-slate-900/50 p-4 border border-gray-100 dark:border-slate-700' : (isSystem ? 'bg-transparent' : 'bg-brand-lightbeige/30 dark:bg-brand-green/10 p-4 border border-brand-beige/30');
        const colorTitle = isUser ? 'text-gray-800 dark:text-white' : (isSystem ? 'text-gray-500' : 'text-brand-green');
        
        return `
        <div class="flex gap-4">
            <div class="flex flex-col items-center">
                <div class="w-10 h-10 rounded-full ${bgIcon} flex items-center justify-center font-bold text-sm z-10 shadow-sm"><i class="fa-solid ${icon}"></i></div>
                <div class="w-0.5 h-full bg-gray-200 dark:bg-slate-700 my-1"></div>
            </div>
            <div class="flex-1 pb-6">
                <div class="flex items-center justify-between mb-1">
                    <p class="font-bold text-sm ${colorTitle}">${item.autor} <span class="text-gray-400 font-normal text-xs ml-1">${isSystem ? 'atualizou o sistema' : 'comentou'}</span></p>
                    <p class="text-[10px] text-gray-400 font-bold">${item.data}</p>
                </div>
                <div class="${bgChat} rounded-xl text-sm ${isSystem ? 'italic text-gray-500' : 'text-gray-600 dark:text-gray-300'}">
                    ${item.mensagem}
                </div>
            </div>
        </div>
        `;
    }).join('');
    setTimeout(() => container.scrollTop = container.scrollHeight, 50);
}

function adicionarComentario(chamadoId) {
    const input = document.getElementById('modal-chat-input');
    const msg = input.value.trim();
    if(!msg) return;
    
    const idx = chamados.findIndex(c => c.id === chamadoId);
    if(idx !== -1) {
        chamados[idx].timeline.push({
            autor: currentUser.nome,
            tipo: (currentUser.role === 'Técnico' || currentUser.role === 'Gestor') ? 'tech' : 'user',
            mensagem: msg, data: new Date().toLocaleString('pt-BR')
        });
        localStorage.setItem('chamados', JSON.stringify(chamados));
        renderizarTimeline(chamados[idx].timeline);
        input.value = '';
    }
}

// ---- PAINEL DO GESTOR ----
function renderizarListaUsuariosGestor() {
    const container = document.getElementById('lista-usuarios-gestor');
    if(!container) return;

    container.innerHTML = usuariosPermitidos.map(user => {
        let roleColor = "bg-gray-100 text-gray-700 dark:bg-slate-700 dark:text-gray-300";
        if(user.role === 'Técnico') roleColor = "bg-brand-lightbeige text-brand-orange border border-brand-orange/20";
        if(user.role === 'Gestor') roleColor = "bg-emerald-100 text-emerald-700 border border-emerald-500/20";

        return `
            <tr class="hover:bg-stone-50 dark:hover:bg-slate-700/50 transition-colors">
                <td class="px-6 py-4 font-bold text-gray-800 dark:text-white flex items-center gap-3">
                    <div class="w-8 h-8 rounded-full bg-brand-green text-white flex items-center justify-center text-xs font-bold shadow-sm">${user.nome.charAt(0)}</div>
                    ${user.nome}
                </td>
                <td class="px-6 py-4 text-gray-600 dark:text-gray-300">${user.email}</td>
                <td class="px-6 py-4 text-right">
                    <span class="px-3 py-1 text-[10px] font-bold uppercase rounded ${roleColor}">${user.role}</span>
                </td>
            </tr>
        `;
    }).join('');
}

// ---- CONFIGURAÇÕES ----
function popularDropdownsFormulario() {
    ['local', 'categoria', 'equipamento'].forEach(id => {
        const el = document.getElementById(id);
        if(el) el.innerHTML = infraData[id].map(i => `<option value="${i}">${i}</option>`).join('');
    });
}
function renderizarListasConfiguracao() {
    ['local', 'categoria', 'equipamento'].forEach(tipo => {
        const target = document.getElementById(`list-settings-${tipo}`);
        if(target) target.innerHTML = infraData[tipo].map((item, idx) => `<div class="flex justify-between items-center py-2 px-3 bg-white dark:bg-slate-800 rounded-lg border border-gray-100 shadow-sm"><span class="font-bold text-sm dark:text-white">${item}</span><button onclick="removerItemInfra('${tipo}', ${idx})" class="text-red-400 hover:text-red-500"><i class="fa-solid fa-trash"></i></button></div>`).join('');
    });
}
function adicionarItemInfra(tipo) {
    const input = document.getElementById(`input-add-${tipo}`);
    if(!input || !input.value.trim()) return;
    infraData[tipo].push(input.value.trim()); localStorage.setItem('infraData', JSON.stringify(infraData));
    input.value = ''; renderizarListasConfiguracao(); popularDropdownsFormulario(); spawnNotification('success', 'Cadastrado', 'Item adicionado com sucesso.');
}
function removerItemInfra(tipo, index) {
    infraData[tipo].splice(index, 1); localStorage.setItem('infraData', JSON.stringify(infraData));
    renderizarListasConfiguracao(); popularDropdownsFormulario();
}