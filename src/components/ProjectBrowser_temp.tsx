        {/* Change Logs Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              onClick={() => onViewChange?.('changelogs')}
              className={`w-full flex items-center rounded-lg transition-all mb-2 group p-3 ${
                activeView === 'changelogs'
                  ? 'bg-gradient-to-r from-[#FF6B35] to-[#FFA07A] text-white'
                  : 'text-[#9CA3AF] hover:bg-[rgba(255,107,53,0.1)] hover:text-white'
              }`}
            >
              <FileText className={`w-4 h-4 flex-shrink-0 ${activeView !== 'changelogs' && isCollapsed ? 'group-hover:text-[#FF6B35]' : ''}`} />
              <AnimatePresence>
                {!isCollapsed && (
                  <motion.span 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="text-sm whitespace-nowrap overflow-hidden ml-3"
                  >
                    Change Logs
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </TooltipTrigger>
          {isCollapsed && (
            <TooltipContent side="right" className="bg-[#2D3B4E] border-[rgba(255,107,53,0.3)] text-white">
              Change Logs
            </TooltipContent>
          )}
        </Tooltip>
